package cmd

import (
	"path/filepath"
	"testing"

	"github.com/asdine/storm/v3"
	"github.com/spf13/viper"
	"github.com/stretchr/testify/require"

	"github.com/MatinDehghanian/filebrowser/v2/storage/bolt"
	"github.com/MatinDehghanian/filebrowser/v2/users"
)

func TestQuickSetupAcceptsPlaintextAndHashedPasswords(t *testing.T) {
	const password = "Audit-only-pass-47"
	hash, err := users.HashPwd(password)
	require.NoError(t, err)
	for _, input := range []string{password, hash} {
		t.Run(input[:4], func(t *testing.T) {
			db, err := storm.Open(filepath.Join(t.TempDir(), "test.db"))
			require.NoError(t, err)
			defer db.Close()
			store, err := bolt.NewStorage(db)
			require.NoError(t, err)
			v := viper.New()
			v.Set("username", "admin")
			v.Set("password", input)
			v.Set("root", t.TempDir())
			require.NoError(t, quickSetup(v, store))
			user, err := store.Users.Get("", "admin")
			require.NoError(t, err)
			require.True(t, users.CheckPwd(password, user.Password))
			require.NotEqual(t, password, user.Password)
		})
	}
}
