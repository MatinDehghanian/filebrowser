package files

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/spf13/afero"
	"github.com/stretchr/testify/require"
)

func TestScopedFilesystemConfinesReadWriteAndShare(t *testing.T) {
	root := t.TempDir()
	require.NoError(t, os.MkdirAll(filepath.Join(root, "user", "share"), 0755))
	require.NoError(t, os.Mkdir(filepath.Join(root, "outside"), 0755))
	require.NoError(t, os.WriteFile(filepath.Join(root, "outside", "secret"), []byte("private"), 0644))
	require.NoError(t, os.Symlink("../outside", filepath.Join(root, "user", "escape")))
	fs := NewScopedFs(filepath.Join(root, "user"))
	_, err := afero.ReadFile(fs, "/escape/secret")
	require.Error(t, err)
	require.Error(t, afero.WriteFile(fs, "/escape/secret", []byte("bad"), 0644))
	require.Error(t, fs.MkdirAll("/escape/new", 0755))
	require.Error(t, fs.Remove("/escape/secret"))
	require.NoError(t, afero.WriteFile(fs, "/safe", []byte("safe"), 0644))
	require.Error(t, fs.Rename("/safe", "/escape/new"))
	require.NoError(t, os.Symlink("../safe", filepath.Join(root, "user", "share", "alias")))
	child, err := Subdirectory(fs, "/share")
	require.NoError(t, err)
	_, err = afero.ReadFile(child, "/alias")
	require.Error(t, err)
	require.NoError(t, fs.Remove("/escape")) // removing a link must not dereference it
	got, err := os.ReadFile(filepath.Join(root, "outside", "secret"))
	require.NoError(t, err)
	require.Equal(t, "private", string(got))
}

func TestRootDirectoryCanBeShared(t *testing.T) {
	root := t.TempDir()
	fs := NewScopedFs(root)
	require.NoError(t, afero.WriteFile(fs, "/note", []byte("root share"), 0644))
	share, err := Subdirectory(fs, "/")
	require.NoError(t, err)
	got, err := afero.ReadFile(share, "/note")
	require.NoError(t, err)
	require.Equal(t, "root share", string(got))
}
