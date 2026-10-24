package fileutils

import (
	"errors"
	"os"
	"testing"

	"github.com/spf13/afero"
	"github.com/stretchr/testify/require"
)

type interruptedFile struct{ afero.File }

func (f interruptedFile) Read([]byte) (int, error) { return 0, errors.New("read interrupted") }

type failingCopyFS struct{ afero.Fs }

func (f failingCopyFS) Open(name string) (afero.File, error) {
	file, err := f.Fs.Open(name)
	return interruptedFile{file}, err
}

type deniedRenameFS struct{ afero.Fs }

func (f deniedRenameFS) Rename(string, string) error { return os.ErrPermission }

func TestFailedCopyPreservesDestination(t *testing.T) {
	fs := afero.NewMemMapFs()
	require.NoError(t, afero.WriteFile(fs, "/src", []byte("new"), 0644))
	require.NoError(t, afero.WriteFile(fs, "/dst", []byte("original"), 0644))
	require.Error(t, CopyFile(failingCopyFS{fs}, "/src", "/dst", 0644, 0755))
	content, err := afero.ReadFile(fs, "/dst")
	require.NoError(t, err)
	require.Equal(t, "original", string(content))
	entries, err := afero.ReadDir(fs, "/")
	require.NoError(t, err)
	require.Len(t, entries, 2)
}
func TestDeniedMoveDoesNotDeleteDestination(t *testing.T) {
	fs := afero.NewMemMapFs()
	require.NoError(t, afero.WriteFile(fs, "/src", []byte("source"), 0644))
	require.NoError(t, afero.WriteFile(fs, "/dst", []byte("original"), 0644))
	require.ErrorIs(t, MoveFile(deniedRenameFS{fs}, "/src", "/dst", 0644, 0755), os.ErrPermission)
	content, err := afero.ReadFile(fs, "/dst")
	require.NoError(t, err)
	require.Equal(t, "original", string(content))
	content, err = afero.ReadFile(fs, "/src")
	require.NoError(t, err)
	require.Equal(t, "source", string(content))
}
