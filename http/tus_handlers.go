package fbhttp

import (
	"crypto/sha256"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/MatinDehghanian/filebrowser/v2/files"
)

// keepUploadActive periodically touches the cache entry to prevent eviction during transfer.
func keepUploadActive(cache UploadCache, filePath string) func() {
	stop := make(chan struct{})
	go func() {
		ticker := time.NewTicker(2 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-stop:
				return
			case <-ticker.C:
				cache.Touch(filePath)
			}
		}
	}()
	return func() { close(stop) }
}

// Resumable uploads are staged beside the destination. An interrupted upload,
// cancellation, or cache eviction must never truncate or delete an existing file.
func tusStagingPath(destination string) string {
	name := fmt.Sprintf(".filebrowser-tus-%x", sha256.Sum256([]byte(filepath.Clean(destination))))
	return filepath.Join(filepath.Dir(destination), name)
}

func tusStagingFile(d *data, destination string) (*files.FileInfo, error) {
	staging := tusStagingPath(destination)
	info, err := d.user.Fs.Stat(staging)
	if err != nil {
		return nil, err
	}
	return &files.FileInfo{Fs: d.user.Fs, Path: staging, Name: info.Name(), Size: info.Size(), IsDir: info.IsDir()}, nil
}

func tusPostHandler(cache UploadCache) handleFunc {
	return withUser(func(w http.ResponseWriter, r *http.Request, d *data) (int, error) {
		if !d.user.Perm.Create || !d.Check(r.URL.Path) {
			return http.StatusForbidden, nil
		}
		uploadLength, err := getUploadLength(r)
		if err != nil {
			return http.StatusBadRequest, err
		}
		if info, err := d.user.Fs.Stat(r.URL.Path); err == nil {
			if info.IsDir() {
				return http.StatusBadRequest, fmt.Errorf("cannot upload to a directory")
			}
			if r.URL.Query().Get("override") != "true" {
				return http.StatusConflict, nil
			}
			if !d.user.Perm.Modify {
				return http.StatusForbidden, nil
			}
		} else if !os.IsNotExist(err) {
			return errToStatus(err), err
		}
		if err := d.user.Fs.MkdirAll(filepath.Dir(r.URL.Path), d.settings.DirMode); err != nil {
			return errToStatus(err), err
		}
		staging := tusStagingPath(r.URL.Path)
		file, err := d.user.Fs.OpenFile(staging, os.O_CREATE|os.O_EXCL|os.O_WRONLY, d.settings.FileMode)
		if err != nil {
			return errToStatus(err), err
		}
		if err := file.Close(); err != nil {
			_ = d.user.Fs.Remove(staging)
			return errToStatus(err), err
		}
		if uploadLength == 0 {
			if err := d.user.Fs.Rename(staging, r.URL.Path); err != nil {
				_ = d.user.Fs.Remove(staging)
				return errToStatus(err), err
			}
		} else {
			staged := &files.FileInfo{Fs: d.user.Fs, Path: staging}
			cache.Register(staged.RealPath(), uploadLength)
		}
		basePath := strings.TrimRight(d.server.BaseURL, "/")
		w.Header().Set("Location", basePath+"/api/tus"+r.URL.EscapedPath())
		return http.StatusCreated, nil
	})
}

func tusHeadHandler(cache UploadCache) handleFunc {
	return withUser(func(w http.ResponseWriter, r *http.Request, d *data) (int, error) {
		w.Header().Set("Cache-Control", "no-store")
		if !d.user.Perm.Create || !d.Check(r.URL.Path) {
			return http.StatusForbidden, nil
		}
		file, err := tusStagingFile(d, r.URL.Path)
		if err != nil {
			return errToStatus(err), err
		}
		length, err := cache.GetLength(file.RealPath())
		if err != nil {
			return http.StatusNotFound, err
		}
		w.Header().Set("Upload-Offset", strconv.FormatInt(file.Size, 10))
		w.Header().Set("Upload-Length", strconv.FormatInt(length, 10))
		return http.StatusOK, nil
	})
}

func tusPatchHandler(cache UploadCache) handleFunc {
	return withUser(func(w http.ResponseWriter, r *http.Request, d *data) (int, error) {
		if !d.user.Perm.Create || !d.Check(r.URL.Path) {
			return http.StatusForbidden, nil
		}
		if r.Header.Get("Content-Type") != "application/offset+octet-stream" {
			return http.StatusUnsupportedMediaType, nil
		}
		offset, err := getUploadOffset(r)
		if err != nil {
			return http.StatusBadRequest, err
		}
		file, err := tusStagingFile(d, r.URL.Path)
		if err != nil {
			return errToStatus(err), err
		}
		length, err := cache.GetLength(file.RealPath())
		if err != nil {
			return http.StatusNotFound, err
		}
		if file.Size != offset || offset > length {
			return http.StatusConflict, fmt.Errorf("upload offset does not match the uploaded size")
		}
		stop := keepUploadActive(cache, file.RealPath())
		defer stop()
		output, err := d.user.Fs.OpenFile(file.Path, os.O_WRONLY, d.settings.FileMode)
		if err != nil {
			return errToStatus(err), err
		}
		defer output.Close()
		if _, err := output.Seek(offset, io.SeekStart); err != nil {
			return errToStatus(err), err
		}
		// Probe one byte beyond the declared length, then roll the chunk back if needed.
		remaining := length - offset
		written, err := io.Copy(output, io.LimitReader(r.Body, remaining))
		if err == nil && written == remaining {
			var extra [1]byte
			n, readErr := io.ReadFull(r.Body, extra[:])
			if n > 0 {
				err = fmt.Errorf("upload exceeds the declared length")
			} else if readErr != nil && !errors.Is(readErr, io.EOF) {
				err = readErr
			}
		}
		if err != nil {
			_ = output.Truncate(offset)
			return http.StatusBadRequest, err
		}
		if err := output.Sync(); err != nil {
			_ = output.Truncate(offset)
			return errToStatus(err), err
		}
		if err := output.Close(); err != nil {
			return errToStatus(err), err
		}
		newOffset := offset + written
		if newOffset == length {
			if _, err := d.user.Fs.Stat(r.URL.Path); err == nil && !d.user.Perm.Modify {
				return http.StatusForbidden, nil
			}
			if err := d.user.Fs.Rename(file.Path, r.URL.Path); err != nil {
				return errToStatus(err), err
			}
			cache.Complete(file.RealPath())
			if err := d.RunHook(func() error { return nil }, "upload", r.URL.Path, "", d.user); err != nil {
				return errToStatus(err), err
			}
		}
		w.Header().Set("Upload-Offset", strconv.FormatInt(newOffset, 10))
		return http.StatusNoContent, nil
	})
}

func tusDeleteHandler(cache UploadCache) handleFunc {
	return withUser(func(_ http.ResponseWriter, r *http.Request, d *data) (int, error) {
		if r.URL.Path == "/" || !d.user.Perm.Delete || !d.Check(r.URL.Path) {
			return http.StatusForbidden, nil
		}
		file, err := tusStagingFile(d, r.URL.Path)
		if err != nil {
			return errToStatus(err), err
		}
		if _, err := cache.GetLength(file.RealPath()); err != nil {
			return http.StatusNotFound, err
		}
		if err := d.user.Fs.Remove(file.Path); err != nil {
			return errToStatus(err), err
		}
		cache.Complete(file.RealPath())
		return http.StatusNoContent, nil
	})
}

func getUploadLength(r *http.Request) (int64, error) { return uploadIntegerHeader(r, "Upload-Length") }
func getUploadOffset(r *http.Request) (int64, error) { return uploadIntegerHeader(r, "Upload-Offset") }
func uploadIntegerHeader(r *http.Request, name string) (int64, error) {
	value, err := strconv.ParseInt(r.Header.Get(name), 10, 64)
	if err != nil || value < 0 {
		return 0, fmt.Errorf("invalid %s: expected a non-negative integer", name)
	}
	return value, nil
}
