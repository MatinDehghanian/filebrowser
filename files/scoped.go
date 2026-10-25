package files

import (
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/spf13/afero"
)

// ScopedFs uses the operating system's rooted operations, including their
// symlink confinement. Each operation owns its root handle; returned files own
// their descriptors independently, so request-scoped user objects leak no handles.
// A share opens a child root through its owner's root, rather than reopening an
// unchecked absolute path.
type ScopedFs struct {
	directory string
	parent    *ScopedFs
}

func NewScopedFs(directory string) *ScopedFs {
	if directory == "" {
		directory = "."
	}
	return &ScopedFs{directory: directory}
}

func Subdirectory(fs afero.Fs, directory string) (afero.Fs, error) {
	if parent, ok := fs.(*ScopedFs); ok {
		child := &ScopedFs{directory: directory, parent: parent}
		r, err := child.openRoot()
		if err != nil {
			return nil, err
		}
		r.Close()
		return child, nil
	}
	return afero.NewBasePathFs(fs, directory), nil
}

func localName(name string) string {
	return strings.TrimLeft(filepath.Clean("/"+name), string(filepath.Separator))
}
func (s *ScopedFs) openRoot() (*os.Root, error) {
	if s.parent == nil {
		return os.OpenRoot(s.directory)
	}
	parent, err := s.parent.openRoot()
	if err != nil {
		return nil, err
	}
	defer parent.Close()
	return parent.OpenRoot(orDot(localName(s.directory)))
}
func scopedCall[T any](s *ScopedFs, fn func(*os.Root) (T, error)) (T, error) {
	var zero T
	root, err := s.openRoot()
	if IsScopeError(err) {
		return zero, os.ErrPermission
	}
	if err != nil {
		return zero, err
	}
	defer root.Close()
	value, err := fn(root)
	if err != nil && strings.Contains(err.Error(), "escapes") {
		return zero, &os.PathError{Op: "scope", Path: s.directory, Err: os.ErrPermission}
	}
	return value, err
}
func (s *ScopedFs) action(fn func(*os.Root) error) error {
	_, err := scopedCall(s, func(r *os.Root) (bool, error) { return true, fn(r) })
	return err
}
func (s *ScopedFs) Name() string { return "ScopedFs" }
func (s *ScopedFs) RealPath(name string) (string, error) {
	base := s.directory
	if s.parent != nil {
		base, _ = s.parent.RealPath(base)
	}
	return filepath.Abs(filepath.Join(base, localName(name)))
}

type scopedFile struct {
	*os.File
	name string
}

func (f *scopedFile) Name() string { return f.name }
func (s *ScopedFs) OpenFile(name string, flag int, mode os.FileMode) (afero.File, error) {
	return scopedCall(s, func(r *os.Root) (afero.File, error) {
		f, err := r.OpenFile(orDot(localName(name)), flag, mode)
		if err != nil {
			return nil, err
		}
		return &scopedFile{File: f, name: name}, nil
	})
}
func orDot(name string) string {
	if name == "" {
		return "."
	}
	return name
}
func (s *ScopedFs) Open(name string) (afero.File, error) { return s.OpenFile(name, os.O_RDONLY, 0) }
func (s *ScopedFs) Create(name string) (afero.File, error) {
	return s.OpenFile(name, os.O_RDWR|os.O_CREATE|os.O_TRUNC, 0666)
}
func (s *ScopedFs) Mkdir(name string, mode os.FileMode) error {
	return s.action(func(r *os.Root) error { return r.Mkdir(orDot(localName(name)), mode) })
}
func (s *ScopedFs) MkdirAll(name string, mode os.FileMode) error {
	return s.action(func(r *os.Root) error { return r.MkdirAll(orDot(localName(name)), mode) })
}
func (s *ScopedFs) Remove(name string) error {
	return s.action(func(r *os.Root) error { return r.Remove(orDot(localName(name))) })
}
func (s *ScopedFs) RemoveAll(name string) error {
	return s.action(func(r *os.Root) error { return r.RemoveAll(orDot(localName(name))) })
}
func (s *ScopedFs) Rename(oldname, newname string) error {
	return s.action(func(r *os.Root) error { return r.Rename(orDot(localName(oldname)), orDot(localName(newname))) })
}
func (s *ScopedFs) Stat(name string) (os.FileInfo, error) {
	return scopedCall(s, func(r *os.Root) (os.FileInfo, error) { return r.Stat(orDot(localName(name))) })
}
func (s *ScopedFs) LstatIfPossible(name string) (os.FileInfo, bool, error) {
	info, err := scopedCall(s, func(r *os.Root) (os.FileInfo, error) { return r.Lstat(orDot(localName(name))) })
	return info, true, err
}
func (s *ScopedFs) Chmod(name string, mode os.FileMode) error {
	f, err := s.Open(name)
	if err != nil {
		return err
	}
	defer f.Close()
	return f.(*scopedFile).Chmod(mode)
}
func (s *ScopedFs) Chown(name string, uid, gid int) error {
	f, err := s.Open(name)
	if err != nil {
		return err
	}
	defer f.Close()
	return f.(*scopedFile).Chown(uid, gid)
}
func (s *ScopedFs) Chtimes(name string, atime, mtime time.Time) error {
	return s.action(func(r *os.Root) error { return r.Chtimes(orDot(localName(name)), atime, mtime) })
}

// CaseInsensitive detects the actual mount, rather than assuming an OS default.
func CaseInsensitive(root string) bool {
	f, err := os.CreateTemp(root, "fb-case-*")
	if err != nil {
		return filepath.Separator == '\\' || runtime.GOOS == "darwin"
	}
	f.Close()
	defer os.Remove(f.Name())
	_, err = os.Stat(filepath.Join(filepath.Dir(f.Name()), strings.ToUpper(filepath.Base(f.Name()))))
	return err == nil
}
func IsScopeError(err error) bool {
	return errors.Is(err, os.ErrPermission) || err != nil && strings.Contains(err.Error(), "escapes")
}
