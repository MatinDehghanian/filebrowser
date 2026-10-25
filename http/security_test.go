package fbhttp

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/MatinDehghanian/filebrowser/v2/auth"
	"github.com/MatinDehghanian/filebrowser/v2/rules"
	"github.com/MatinDehghanian/filebrowser/v2/settings"
	"github.com/MatinDehghanian/filebrowser/v2/share"
	"github.com/MatinDehghanian/filebrowser/v2/users"
	"github.com/golang-jwt/jwt/v5"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/require"
)

// Regressions for the access-control failures found during the upstream audit.
func TestSecurityDownloadPermission(t *testing.T) {
	f := newAPIFixture(t, "")
	require.NoError(t, afero.WriteFile(f.fs, "/secret.txt", []byte("private-text"), 0644))
	require.NoError(t, f.store.Users.Save(&users.User{Username: "backup", Password: "hash", Perm: users.Permissions{Admin: true}}))
	f.user.Perm = users.Permissions{}
	require.NoError(t, f.store.Users.Update(f.user, "Perm"))
	for _, suffix := range []string{"", "?checksum=sha256", "?content=true"} {
		r := f.request(t, "GET", "/api/resources/secret.txt"+suffix, "")
		require.NotContains(t, r.Body.String(), "private-text")
		if strings.Contains(suffix, "checksum") {
			require.Equal(t, 403, r.Code)
		} else {
			require.Equal(t, 200, r.Code)
		}
	}
}

func TestSecuritySharePermissionsAndSecrets(t *testing.T) {
	f := newAPIFixture(t, "")
	require.NoError(t, afero.WriteFile(f.fs, "/note.txt", []byte("shared-data"), 0644))
	created := f.request(t, "POST", "/api/share/note.txt", `{"password":"secret"}`)
	require.Equal(t, 200, created.Code)
	var link share.Link
	require.NoError(t, json.Unmarshal(created.Body.Bytes(), &link))
	require.Empty(t, link.PasswordHash)
	require.Empty(t, link.Token)
	stored, err := f.store.Share.GetByHash(link.Hash)
	require.NoError(t, err)
	require.NotEmpty(t, stored.Token)
	listed := f.request(t, "GET", "/api/shares/", "")
	require.NotContains(t, listed.Body.String(), "password_hash")
	require.NotContains(t, listed.Body.String(), `"token"`)
	require.Contains(t, listed.Body.String(), `"hasPassword":true`)
	f.user.Perm.Share = false
	f.user.Perm.Download = false
	require.NoError(t, f.store.Users.Update(f.user, "Perm"))
	r := f.request(t, "GET", "/api/public/dl/"+link.Hash+"?token="+stored.Token, "")
	require.Equal(t, 403, r.Code)
}

func TestSecurityRecursiveRules(t *testing.T) {
	for _, action := range []string{"copy", "delete"} {
		t.Run(action, func(t *testing.T) {
			f := newAPIFixture(t, "")
			require.NoError(t, f.fs.MkdirAll("/folder", 0755))
			require.NoError(t, afero.WriteFile(f.fs, "/folder/secret.txt", []byte("hidden"), 0644))
			f.user.Rules = []rules.Rule{{Path: "/folder/secret.txt", Allow: false}}
			require.NoError(t, f.store.Users.Update(f.user, "Rules"))
			require.Equal(t, 403, f.request(t, "GET", "/api/resources/folder/secret.txt", "").Code)
			if action == "copy" {
				require.Equal(t, 403, f.request(t, "PATCH", "/api/resources/folder?action=copy&destination=%2Fcopied", "").Code)
			} else {
				require.Equal(t, 403, f.request(t, "DELETE", "/api/resources/folder", "").Code)
			}
			got, err := afero.ReadFile(f.fs, "/folder/secret.txt")
			require.NoError(t, err)
			require.Equal(t, "hidden", string(got))
		})
	}
}

func TestSecuritySymlinkScope(t *testing.T) {
	base := t.TempDir()
	require.NoError(t, os.Mkdir(filepath.Join(base, "scope"), 0755))
	require.NoError(t, os.WriteFile(filepath.Join(base, "outside.txt"), []byte("outside-scope"), 0644))
	require.NoError(t, os.Symlink(filepath.Join(base, "outside.txt"), filepath.Join(base, "scope", "link.txt")))
	u := &users.User{Username: "scoped", Password: "hash", Scope: "/scope"}
	require.NoError(t, u.Clean(base))
	_, err := afero.ReadFile(u.Fs, "/link.txt")
	require.Error(t, err)
	require.Error(t, u.Fs.MkdirAll("/link.txt/child", 0755))
	require.NoError(t, os.Mkdir(filepath.Join(base, "scope", "inner"), 0755))
	require.NoError(t, os.WriteFile(filepath.Join(base, "scope", "inner", "ok"), []byte("inside"), 0644))
	require.NoError(t, os.Symlink("inner", filepath.Join(base, "scope", "relative")))
	got, err := afero.ReadFile(u.Fs, "/relative/ok")
	require.NoError(t, err)
	require.Equal(t, "inside", string(got))
}

func TestSecuritySignupProvisioning(t *testing.T) {
	f := newAPIFixture(t, "")
	config, err := f.store.Settings.Get()
	require.NoError(t, err)
	config.Signup = true
	config.CreateUserDir = true
	config.UserHomeBasePath = "/users"
	config.Defaults.Perm.Execute = true
	config.Defaults.Commands = []string{"echo"}
	require.NoError(t, f.store.Settings.Save(config))
	// Use a temporary real root for home creation; no production filesystem paths.
	root := t.TempDir()
	for i, name := range []string{"teamone-x", "teamone/x"} {
		req := httptest.NewRequest("POST", "/", strings.NewReader(`{"username":"`+name+`","password":"long-enough-password"}`))
		cfg := *config
		data := &data{store: f.store, settings: &cfg}
		data.server = &settings.Server{Root: root}
		status, err := signupHandler(httptest.NewRecorder(), req, data)
		if i == 0 {
			require.NoError(t, err)
			require.Equal(t, 200, status)
		} else {
			require.Equal(t, 409, status)
		}
	}
	a, err := f.store.Users.Get(root, "teamone-x")
	require.NoError(t, err)
	b, err := f.store.Users.Get(root, "teamone/x")
	require.Error(t, err)
	require.Nil(t, b)
	require.False(t, a.Perm.Execute)
	require.Empty(t, a.Commands)
}

func TestSecurityExpiredProxyToken(t *testing.T) {
	f := newAPIFixture(t, "")
	config, err := f.store.Settings.Get()
	require.NoError(t, err)
	config.AuthMethod = auth.MethodProxyAuth
	config.LogoutPage = "/signed-out"
	require.NoError(t, f.store.Settings.Save(config))
	require.NoError(t, f.store.Auth.Save(&auth.ProxyAuth{Header: "X-Forwarded-User"}))
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, authToken{User: userInfo{ID: f.user.ID}, RegisteredClaims: jwt.RegisteredClaims{ExpiresAt: jwt.NewNumericDate(time.Now().Add(-24 * time.Hour))}}).SignedString(f.key)
	require.NoError(t, err)
	req := httptest.NewRequest("GET", "/api/resources/", nil)
	req.Header.Set("X-Auth", token)
	recorder := httptest.NewRecorder()
	f.handler.ServeHTTP(recorder, req)
	require.Equal(t, 401, recorder.Code)
}

func TestSecurityArchiveNames(t *testing.T) {
	f := newAPIFixture(t, "")
	require.NoError(t, f.fs.MkdirAll("/folder", 0755))
	require.NoError(t, afero.WriteFile(f.fs, `/folder/..\..\outside.txt`, []byte("x"), 0644))
	r := f.request(t, "GET", "/api/raw/folder", "")
	require.Equal(t, 200, r.Code)
	z, err := zip.NewReader(bytes.NewReader(r.Body.Bytes()), int64(r.Body.Len()))
	require.NoError(t, err)
	require.Len(t, z.File, 1)
	require.NotContains(t, z.File[0].Name, `\`)
}

func TestSecurityRuleBoundary(t *testing.T) {
	r := rules.Rule{Path: "/private", Allow: true}
	require.False(t, r.Matches("/private-other/secret.txt"))
	require.True(t, r.Matches("/private/secret.txt"))
	require.True(t, r.Matches("/PRIVATE/secret.txt", true))
}

func TestSecurityLoginBodyLimit(t *testing.T) {
	f := newAPIFixture(t, "")
	body := `{"username":"admin","password":"test-admin-pass","padding":"` + strings.Repeat("x", 2<<20) + `"}`
	r := f.request(t, "POST", "/api/login", body)
	require.Equal(t, 413, r.Code)
}

func TestSecurityProxyProvisioning(t *testing.T) {
	f := newAPIFixture(t, "")
	config, err := f.store.Settings.Get()
	require.NoError(t, err)
	config.CreateUserDir = true
	config.UserHomeBasePath = "/users"
	config.Defaults.Perm.Admin = true
	config.Defaults.Perm.Execute = true
	config.Defaults.Commands = []string{"echo"}
	root := t.TempDir()
	proxy := auth.ProxyAuth{Header: "X-Forwarded-User"}
	r := httptest.NewRequest("GET", "/", nil)
	r.Header.Set("X-Forwarded-User", "new-proxy-user")
	u, err := proxy.Auth(r, f.store.Users, config, &settings.Server{Root: root})
	require.NoError(t, err)
	require.Equal(t, "/users/new-proxy-user", u.Scope)
	require.False(t, u.Perm.Admin)
	require.False(t, u.Perm.Execute)
}

func TestConcurrentProvisioningRejectsSharedDerivedHome(t *testing.T) {
	f := newAPIFixture(t, "")
	results := make(chan error, 2)
	for _, name := range []string{"one", "two"} {
		go func(name string) {
			results <- f.store.Users.SaveProvisioned(&users.User{Username: name, Password: "hash", Scope: "/users/shared"}, true)
		}(name)
	}
	success := 0
	for range 2 {
		if <-results == nil {
			success++
		}
	}
	require.Equal(t, 1, success)
}

func TestTUSFingerprintAndDestinationRace(t *testing.T) {
	f := newAPIFixture(t, "")
	require.Equal(t, 201, f.request(t, "POST", "/api/tus/new.txt", "", map[string]string{"Upload-Length": "4", "Upload-Fingerprint": "file-one"}).Code)
	head := f.request(t, "HEAD", "/api/tus/new.txt", "")
	require.Equal(t, "file-one", head.Header().Get("Upload-Fingerprint"))
	require.NoError(t, afero.WriteFile(f.fs, "/new.txt", []byte("existing"), 0644))
	require.Equal(t, 409, f.request(t, "PATCH", "/api/tus/new.txt", "data", map[string]string{"Upload-Offset": "0", "Content-Type": "application/offset+octet-stream"}).Code)
	got, err := afero.ReadFile(f.fs, "/new.txt")
	require.NoError(t, err)
	require.Equal(t, "existing", string(got))
}

func TestExpiredUploadCleanupCannotRemoveReplacement(t *testing.T) {
	f := newAPIFixture(t, "")
	cache := newMemoryUploadCache()
	defer cache.Close()
	f.handler = handle(tusPostHandler(cache), "/api/tus", f.store, &settings.Server{})
	require.Equal(t, 201, f.request(t, "POST", "/api/tus/file", "", map[string]string{"Upload-Length": "4"}).Code)
	keys := cache.cache.Keys()
	require.Len(t, keys, 1)
	staleCleanup := cache.cache.Get(keys[0]).Value().remove
	cache.Complete(keys[0])
	require.Equal(t, 201, f.request(t, "POST", "/api/tus/file", "", map[string]string{"Upload-Length": "6"}).Code)
	require.NoError(t, staleCleanup())
	f.handler = handle(tusHeadHandler(cache), "/api/tus", f.store, &settings.Server{})
	head := f.request(t, "HEAD", "/api/tus/file", "")
	require.Equal(t, 200, head.Code)
	require.Equal(t, "6", head.Header().Get("Upload-Length"))
}
