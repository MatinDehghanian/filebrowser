package fbhttp

import (
	"errors"
	"net/http"
	"net/url"
	"path"
	"path/filepath"
	"strings"

	"github.com/spf13/afero"
	"golang.org/x/crypto/bcrypt"

	"github.com/MatinDehghanian/filebrowser/v2/files"
	"github.com/MatinDehghanian/filebrowser/v2/settings"
	"github.com/MatinDehghanian/filebrowser/v2/share"
)

var withHashFile = func(fn handleFunc) handleFunc {
	return func(w http.ResponseWriter, r *http.Request, d *data) (int, error) {
		id, ifPath := ifPathWithName(r)
		link, err := d.store.Share.GetByHash(id)
		if err != nil {
			return errToStatus(err), err
		}

		status, err := authenticateShareRequest(r, link, d)
		if status != 0 || err != nil {
			return status, err
		}

		user, err := d.store.Users.Get(d.server.Root, link.UserID)
		if err != nil {
			return errToStatus(err), err
		}

		d.user = user

		file, err := files.NewFileInfo(&files.FileOptions{
			Fs:         d.user.Fs,
			Path:       link.Path,
			Modify:     d.user.Perm.Modify,
			Expand:     false,
			ReadHeader: d.server.TypeDetectionByHeader,
			CalcImgRes: d.server.TypeDetectionByHeader,
			Checker:    d,
			Token:      link.Token,
		})
		if err != nil {
			return errToStatus(err), err
		}

		// share base path
		basePath := link.Path

		// file relative path
		filePath := ""

		if file.IsDir {
			basePath = filepath.Clean(link.Path)
			filePath = ifPath
		}

		// set fs root to the shared file/folder
		d.user.Fs = afero.NewBasePathFs(d.user.Fs, basePath)

		file, err = files.NewFileInfo(&files.FileOptions{
			Fs:      d.user.Fs,
			Path:    filePath,
			Modify:  d.user.Perm.Modify,
			Expand:  true,
			Checker: d,
			Token:   link.Token,
		})
		if err != nil {
			return errToStatus(err), err
		}

		if file.IsDir {
			// extract name from the last directory in the path
			name := filepath.Base(strings.TrimRight(link.Path, string(filepath.Separator)))
			file.Name = name
		}

		d.raw = file
		return fn(w, r, d)
	}
}

// ref to https://github.com/MatinDehghanian/filebrowser/pull/727
// `/api/public/dl/MEEuZK-v/file-name.txt` for old browsers to save file with correct name
func ifPathWithName(r *http.Request) (id, filePath string) {
	pathElements := strings.Split(r.URL.Path, "/")
	// prevent maliciously constructed parameters like `/api/public/dl/XZzCDnK2_not_exists_hash_name`
	// len(pathElements) will be 1, and golang will panic `runtime error: index out of range`

	switch len(pathElements) {
	case 1:
		return r.URL.Path, "/"
	default:
		return pathElements[0], path.Join("/", path.Join(pathElements[1:]...))
	}
}

var publicShareHandler = withHashFile(func(w http.ResponseWriter, r *http.Request, d *data) (int, error) {
	file := d.raw.(*files.FileInfo)
	if err := incrementShareVisitCount(r, d); err != nil {
		return http.StatusInternalServerError, err
	}

	if file.IsDir {
		file.Sorting = files.Sorting{By: "name", Asc: false}
		file.ApplySort()
		return renderJSON(w, r, file)
	}

	return renderJSON(w, r, file)
})

var publicDlHandler = withHashFile(func(w http.ResponseWriter, r *http.Request, d *data) (int, error) {
	file := d.raw.(*files.FileInfo)
	if err := incrementShareDownloadCount(r, d); err != nil {
		return http.StatusInternalServerError, err
	}
	if !file.IsDir {
		return rawFileHandler(w, r, file)
	}

	return rawDirHandler(w, r, d, file)
})

func authenticateShareRequest(r *http.Request, l *share.Link, d *data) (int, error) {
	if l.PasswordHash == "" {
		return 0, nil
	}

	if r.URL.Query().Get("token") == l.Token {
		l.AuthSuccessCount++
		if err := d.store.Share.Save(l); err != nil {
			return http.StatusInternalServerError, err
		}
		return 0, nil
	}

	password := r.Header.Get("X-SHARE-PASSWORD")
	password, err := url.QueryUnescape(password)
	if err != nil {
		return 0, err
	}
	if password == "" {
		l.AuthFailureCount++
		if saveErr := d.store.Share.Save(l); saveErr != nil {
			return http.StatusInternalServerError, saveErr
		}
		return http.StatusUnauthorized, nil
	}
	if err := bcrypt.CompareHashAndPassword([]byte(l.PasswordHash), []byte(password)); err != nil {
		if errors.Is(err, bcrypt.ErrMismatchedHashAndPassword) {
			l.AuthFailureCount++
			if saveErr := d.store.Share.Save(l); saveErr != nil {
				return http.StatusInternalServerError, saveErr
			}
			return http.StatusUnauthorized, nil
		}
		return 0, err
	}

	l.AuthSuccessCount++
	if err := d.store.Share.Save(l); err != nil {
		return http.StatusInternalServerError, err
	}

	return 0, nil
}

func incrementShareVisitCount(r *http.Request, d *data) error {
	id, _ := ifPathWithName(r)
	link, err := d.store.Share.GetByHash(id)
	if err != nil {
		return err
	}

	link.VisitCount++
	return d.store.Share.Save(link)
}

func incrementShareDownloadCount(r *http.Request, d *data) error {
	id, _ := ifPathWithName(r)
	link, err := d.store.Share.GetByHash(id)
	if err != nil {
		return err
	}

	link.DownloadCount++
	return d.store.Share.Save(link)
}

func healthHandler(w http.ResponseWriter, _ *http.Request) {
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"OK"}`))
}

type publicSettingsData struct {
	Signup                bool                `json:"signup"`
	HideLoginButton       bool                `json:"hideLoginButton"`
	MinimumPasswordLength uint                `json:"minimumPasswordLength"`
	AuthMethod            settings.AuthMethod `json:"authMethod"`
	Branding              settings.Branding   `json:"branding"`
}

var publicSettingsHandler = func(w http.ResponseWriter, r *http.Request, d *data) (int, error) {
	data := &publicSettingsData{
		Signup:                d.settings.Signup,
		HideLoginButton:       d.settings.HideLoginButton,
		MinimumPasswordLength: d.settings.MinimumPasswordLength,
		AuthMethod:            d.settings.AuthMethod,
		Branding:              d.settings.Branding,
	}

	return renderJSON(w, r, data)
}
