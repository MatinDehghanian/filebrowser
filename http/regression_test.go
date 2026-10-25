package fbhttp

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"
	"time"

	"github.com/asdine/storm/v3"
	"github.com/golang-jwt/jwt/v5"
	"github.com/spf13/afero"
	"github.com/stretchr/testify/require"

	"github.com/MatinDehghanian/filebrowser/v2/auth"
	"github.com/MatinDehghanian/filebrowser/v2/files"
	"github.com/MatinDehghanian/filebrowser/v2/rules"
	"github.com/MatinDehghanian/filebrowser/v2/settings"
	"github.com/MatinDehghanian/filebrowser/v2/share"
	"github.com/MatinDehghanian/filebrowser/v2/storage"
	"github.com/MatinDehghanian/filebrowser/v2/storage/bolt"
	"github.com/MatinDehghanian/filebrowser/v2/users"
)

type testCache struct{}

func (testCache) Store(context.Context, string, []byte) error        { return nil }
func (testCache) Load(context.Context, string) ([]byte, bool, error) { return nil, false, nil }
func (testCache) Delete(context.Context, string) error               { return nil }

type apiFixture struct {
	handler http.Handler
	store   *storage.Storage
	fs      afero.Fs
	user    *users.User
	key     []byte
	prefix  string
}

func newAPIFixture(t *testing.T, prefix string) *apiFixture {
	t.Helper()
	db, err := storm.Open(filepath.Join(t.TempDir(), "test.db"))
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, db.Close()) })
	store, err := bolt.NewStorage(db)
	require.NoError(t, err)
	key := []byte("test-only-signing-key")
	config := &settings.Settings{Key: key, AuthMethod: auth.MethodJSONAuth, MinimumPasswordLength: 12,
		FileMode: 0640, DirMode: 0750, Shell: []string{"sh", "-c"},
		Branding: settings.Branding{Name: "Original", DisableExternal: true},
		Defaults: settings.UserDefaults{Scope: "/", Locale: "en", Perm: users.Permissions{Download: true}},
		Tus:      settings.Tus{ChunkSize: 1024, RetryCount: 5}}
	require.NoError(t, store.Settings.Save(config))
	require.NoError(t, store.Auth.Save(&auth.JSONAuth{}))
	password, err := users.HashPwd("test-admin-pass")
	require.NoError(t, err)
	user := &users.User{Username: "admin", Password: password, Scope: "/", Locale: "en", ViewMode: "list", Sorting: files.Sorting{By: "name", Asc: true}, Perm: users.Permissions{Admin: true, Create: true, Rename: true, Modify: true, Delete: true, Share: true, Download: true}}
	require.NoError(t, store.Users.Save(user))
	fs := afero.NewBasePathFs(afero.NewMemMapFs(), "/")
	store.Users = &customFSUser{Store: store.Users, fs: fs}
	cache := newMemoryUploadCache()
	t.Cleanup(cache.Close)
	handler, err := NewHandler(nil, testCache{}, cache, store, &settings.Server{BaseURL: prefix}, fstest.MapFS{"index.html": {Data: []byte(`<script src="/runtime-config.js"></script><script src="/static/assets/app.js"></script><script src="./assets/lazy.js"></script><link href="./assets/editor.css" rel="stylesheet">`)}, "assets/app.js": {Data: []byte("ok")}})
	require.NoError(t, err)
	return &apiFixture{handler: handler, store: store, fs: fs, user: user, key: key, prefix: prefix}
}

func (f *apiFixture) request(t *testing.T, method, endpoint, body string, extraHeaders ...map[string]string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, f.prefix+endpoint, strings.NewReader(body))
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, authToken{User: userInfo{ID: f.user.ID}, RegisteredClaims: jwt.RegisteredClaims{ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour))}}).SignedString(f.key)
	require.NoError(t, err)
	req.Header.Set("X-Auth", token)
	for _, headers := range extraHeaders {
		for key, value := range headers {
			req.Header.Set(key, value)
		}
	}
	recorder := httptest.NewRecorder()
	f.handler.ServeHTTP(recorder, req)
	return recorder
}

func TestFileOperationsWithSpecialNames(t *testing.T) {
	f := newAPIFixture(t, "")
	folder := "/پوشه #100%+?"
	file := folder + "/data #100%+?.json"
	encoded := func(p string) string { return (&url.URL{Path: p}).EscapedPath() }
	require.Equal(t, 200, f.request(t, "POST", "/api/resources"+encoded(folder)+"/", "").Code)
	require.Equal(t, 409, f.request(t, "POST", "/api/resources"+encoded(folder)+"/", "").Code)
	original := `{"message":"سلام"}`
	require.Equal(t, 200, f.request(t, "POST", "/api/resources"+encoded(file), original).Code)
	require.Equal(t, 409, f.request(t, "POST", "/api/resources"+encoded(file), "wrong").Code)
	var metadata files.FileInfo
	response := f.request(t, "GET", "/api/resources"+encoded(file), "")
	require.Equal(t, 200, response.Code)
	require.NoError(t, json.Unmarshal(response.Body.Bytes(), &metadata))
	require.Equal(t, original, metadata.Content)
	require.Equal(t, 200, f.request(t, "PUT", "/api/resources"+encoded(file), "updated").Code)
	destination := folder + "/renamed +100%.json"
	query := url.Values{"action": {"move"}, "destination": {destination}}
	require.Equal(t, 200, f.request(t, "PATCH", "/api/resources"+encoded(file)+"?"+query.Encode(), "").Code)
	copied := folder + "/copy #%.json"
	query.Set("action", "copy")
	query.Set("destination", copied)
	require.Equal(t, 200, f.request(t, "PATCH", "/api/resources"+encoded(destination)+"?"+query.Encode(), "").Code)
	require.Equal(t, 409, f.request(t, "PATCH", "/api/resources"+encoded(destination)+"?"+query.Encode(), "").Code)
	query.Set("override", "true")
	require.Equal(t, 200, f.request(t, "PATCH", "/api/resources"+encoded(destination)+"?"+query.Encode(), "").Code)
	require.Equal(t, 200, f.request(t, "GET", "/api/raw"+encoded(copied), "").Code)
	search := f.request(t, "GET", "/api/search"+encoded(folder)+"?query=renamed", "")
	require.Equal(t, 200, search.Code)
	require.Contains(t, search.Body.String(), "renamed +100%.json")
	archive := f.request(t, "GET", "/api/raw"+encoded(folder), "")
	require.Equal(t, 200, archive.Code)
	reader, err := zip.NewReader(bytes.NewReader(archive.Body.Bytes()), int64(archive.Body.Len()))
	require.NoError(t, err)
	require.Len(t, reader.File, 2)
	require.Equal(t, 204, f.request(t, "DELETE", "/api/resources"+encoded(copied), "").Code)
	require.Empty(t, f.request(t, "DELETE", "/api/resources"+encoded(destination), "").Body.String())
	require.Equal(t, 404, f.request(t, "GET", "/api/resources"+encoded(copied), "").Code)
	require.Equal(t, 400, f.request(t, "PATCH", "/api/resources"+encoded(folder)+"?action=copy", "").Code)
	require.Equal(t, 400, f.request(t, "PATCH", "/api/resources"+encoded(folder)+"?action=copy&destination="+url.QueryEscape(folder+"/inside"), "").Code)
}

type failingReader struct{ sent bool }

func (r *failingReader) Read(p []byte) (int, error) {
	if r.sent {
		return 0, errors.New("transfer interrupted")
	}
	r.sent = true
	return copy(p, "partial"), nil
}
func TestInterruptedWritesPreserveOriginal(t *testing.T) {
	for _, existing := range []bool{true, false} {
		t.Run(map[bool]string{true: "overwrite", false: "new upload"}[existing], func(t *testing.T) {
			fs := afero.NewMemMapFs()
			if existing {
				require.NoError(t, afero.WriteFile(fs, "/file.txt", []byte("original"), 0644))
			}
			_, err := writeFile(fs, "/file.txt", &failingReader{}, 0640, 0750)
			require.Error(t, err)
			if existing {
				content, err := afero.ReadFile(fs, "/file.txt")
				require.NoError(t, err)
				require.Equal(t, "original", string(content))
			} else {
				exists, err := afero.Exists(fs, "/file.txt")
				require.NoError(t, err)
				require.False(t, exists)
			}
			entries, err := afero.ReadDir(fs, "/")
			require.NoError(t, err)
			for _, entry := range entries {
				require.NotContains(t, entry.Name(), ".filebrowser-upload-")
			}
		})
	}
}
func TestPartialSettingsPreserveOtherValues(t *testing.T) {
	f := newAPIFixture(t, "")
	response := f.request(t, "PUT", "/api/settings", `{"branding":{"name":"Changed"}}`)
	require.Equal(t, 200, response.Code)
	saved, err := f.store.Settings.Get()
	require.NoError(t, err)
	require.Equal(t, "Changed", saved.Branding.Name)
	require.True(t, saved.Branding.DisableExternal)
	require.Equal(t, uint(12), saved.MinimumPasswordLength)
	require.True(t, saved.Defaults.Perm.Download)
	require.Equal(t, uint64(1024), saved.Tus.ChunkSize)
	require.Equal(t, []string{"sh", "-c"}, saved.Shell)
}
func TestSharesAndExpiredLinks(t *testing.T) {
	f := newAPIFixture(t, "")
	require.NoError(t, afero.WriteFile(f.fs, "/note.txt", []byte("shared"), 0644))
	for _, expires := range []string{"-1", "abc", "999999999999999999999999999"} {
		require.Equal(t, 400, f.request(t, "POST", "/api/share/note.txt", `{"expires":"`+expires+`","unit":"days"}`).Code)
	}
	require.Equal(t, 404, f.request(t, "POST", "/api/share/missing", `{}`).Code)
	created := f.request(t, "POST", "/api/share/note.txt", `{"password":"secret"}`)
	require.Equal(t, 200, created.Code)
	var link share.Link
	require.NoError(t, json.Unmarshal(created.Body.Bytes(), &link))
	require.Empty(t, link.Token)
	require.NotContains(t, created.Body.String(), "password_hash")
	require.NotContains(t, created.Body.String(), `"token"`)
	stored, err := f.store.Share.GetByHash(link.Hash)
	require.NoError(t, err)
	link.Token = stored.Token
	require.Equal(t, 401, f.request(t, "GET", "/api/public/share/"+link.Hash, "").Code)
	require.Equal(t, 200, f.request(t, "GET", "/api/public/share/"+link.Hash+"?token="+url.QueryEscape(link.Token), "").Code)
	downloaded := f.request(t, "GET", "/api/public/dl/"+link.Hash+"?token="+url.QueryEscape(link.Token), "")
	require.Equal(t, 200, downloaded.Code)
	require.Equal(t, "shared", downloaded.Body.String())
	for _, hash := range []string{"expired1", "expired2", "expired3"} {
		require.NoError(t, f.store.Share.Save(&share.Link{Hash: hash, UserID: f.user.ID, Path: "/note.txt", Expire: time.Now().Add(-time.Hour).Unix()}))
	}
	links, err := f.store.Share.All()
	require.NoError(t, err)
	require.Len(t, links, 1)
	require.Equal(t, 200, f.request(t, "DELETE", "/api/share/"+link.Hash, "").Code)
	require.Equal(t, 404, f.request(t, "GET", "/api/public/share/"+link.Hash, "").Code)
}
func TestPermissionsAndInvalidBodies(t *testing.T) {
	f := newAPIFixture(t, "")
	require.Equal(t, 400, f.request(t, "POST", "/api/users", `{"what":"user","data":null}`).Code)
	require.Equal(t, 400, f.request(t, "PUT", "/api/users/1", `{"what":"user"}`).Code)
	require.NoError(t, f.store.Users.Save(&users.User{Username: "backup-admin", Password: "unused-test-hash", Perm: users.Permissions{Admin: true}}))
	f.user.Perm = users.Permissions{}
	require.NoError(t, f.store.Users.Update(f.user, "Perm"))
	require.Equal(t, 403, f.request(t, "POST", "/api/resources/no.txt", "data").Code)
	require.Equal(t, 403, f.request(t, "DELETE", "/api/resources/no.txt", "").Code)
	require.Equal(t, 403, f.request(t, "GET", "/api/settings", "").Code)
	require.Equal(t, 403, f.request(t, "POST", "/api/share/no.txt", `{}`).Code)
}
func TestBaseURLAndStaticAssets(t *testing.T) {
	f := newAPIFixture(t, "/cloud")
	page := f.request(t, "GET", "/files/deep/path", "")
	require.Equal(t, 200, page.Code)
	require.Contains(t, page.Body.String(), `src="/cloud/static/assets/app.js"`)
	require.Contains(t, page.Body.String(), `src="/cloud/static/assets/lazy.js"`)
	require.Contains(t, page.Body.String(), `href="/cloud/static/assets/editor.css"`)
	require.Contains(t, page.Body.String(), `src="/cloud/runtime-config.js"`)
	require.Contains(t, f.request(t, "GET", "/runtime-config.js", "").Body.String(), `BaseURL: "/cloud"`)
	require.Equal(t, "ok", f.request(t, "GET", "/static/assets/app.js", "").Body.String())
	require.Contains(t, page.Header().Get("Content-Security-Policy"), "img-src 'self' data:")
}

var _ io.Reader = (*failingReader)(nil)

func TestLoginRenewAndUserPreferences(t *testing.T) {
	f := newAPIFixture(t, "")
	login := f.request(t, "POST", "/api/login", `{"username":"admin","password":"test-admin-pass"}`)
	require.Equal(t, 200, login.Code)
	require.Len(t, strings.Split(login.Body.String(), "."), 3)
	require.Equal(t, 200, f.request(t, "POST", "/api/renew", "").Code)
	response := f.request(t, "PUT", "/api/users/1", `{"what":"user","which":["singleClick","hideDotfiles","viewMode","sorting"],"data":{"id":1,"singleClick":true,"hideDotfiles":true,"viewMode":"list","sorting":{"by":"size","asc":true}}}`)
	require.Equal(t, 200, response.Code)
	user, err := f.store.Users.Get("", uint(1))
	require.NoError(t, err)
	require.True(t, user.SingleClick)
	require.True(t, user.HideDotfiles)
	require.Equal(t, "size", user.Sorting.By)
	require.Equal(t, 400, f.request(t, "PUT", "/api/users/1", `{"what":"user","which":["password"],"data":{"id":1,"password":"another-strong-pass"},"current_password":"wrong"}`).Code)
	require.Equal(t, 200, f.request(t, "PUT", "/api/users/1", `{"what":"user","which":["password"],"data":{"id":1,"password":"another-strong-pass"},"current_password":"test-admin-pass"}`).Code)
	require.Equal(t, 200, f.request(t, "POST", "/api/login", `{"username":"admin","password":"another-strong-pass"}`).Code)
}

func TestUserCreationUpdatesAndDeletion(t *testing.T) {
	f := newAPIFixture(t, "")
	created := f.request(t, "POST", "/api/users", `{"what":"user","current_password":"test-admin-pass","data":{"username":"second","password":"Second-strong-pass","scope":"/","perm":{"download":true}}}`)
	require.Equal(t, 201, created.Code)
	response := f.request(t, "GET", "/api/users", "")
	var list []users.User
	require.NoError(t, json.Unmarshal(response.Body.Bytes(), &list))
	require.Len(t, list, 2)
	require.Empty(t, list[1].Password)
	require.Equal(t, 200, f.request(t, "DELETE", "/api/users/2", `{"current_password":"test-admin-pass"}`).Code)
	require.Equal(t, 403, f.request(t, "PUT", "/api/users/1", `{"what":"user","which":["perm"],"current_password":"test-admin-pass","data":{"id":1,"perm":{"admin":false}}}`).Code)
	require.Equal(t, 403, f.request(t, "DELETE", "/api/users/1", `{"current_password":"test-admin-pass"}`).Code)
}

func TestCopyInPlaceGetsUniqueName(t *testing.T) {
	f := newAPIFixture(t, "")
	require.NoError(t, afero.WriteFile(f.fs, "/note.txt", []byte("original"), 0644))
	response := f.request(t, "PATCH", "/api/resources/note.txt?action=copy&destination=%2Fnote.txt&rename=true", "")
	require.Equal(t, 200, response.Code)
	copied, err := afero.ReadFile(f.fs, "/note(1).txt")
	require.NoError(t, err)
	require.Equal(t, "original", string(copied))
	original, err := afero.ReadFile(f.fs, "/note.txt")
	require.NoError(t, err)
	require.Equal(t, "original", string(original))
}

func TestSharePathsFollowMoveAndDoNotAffectOtherUsers(t *testing.T) {
	f := newAPIFixture(t, "")
	require.NoError(t, afero.WriteFile(f.fs, "/note.txt", []byte("original"), 0644))
	for _, link := range []*share.Link{{Hash: "mine", UserID: 1, Path: "/note.txt"}, {Hash: "other-user", UserID: 2, Path: "/note.txt"}, {Hash: "sibling", UserID: 1, Path: "/note.txt2"}} {
		require.NoError(t, f.store.Share.Save(link))
	}
	response := f.request(t, "PATCH", "/api/resources/note.txt?action=move&destination=%2Fmoved.txt", "")
	require.Equal(t, 200, response.Code)
	mine, err := f.store.Share.GetByHash("mine")
	require.NoError(t, err)
	require.Equal(t, "/moved.txt", mine.Path)
	require.Equal(t, 204, f.request(t, "DELETE", "/api/resources/moved.txt", "").Code)
	_, err = f.store.Share.GetByHash("mine")
	require.Error(t, err)
	_, err = f.store.Share.GetByHash("other-user")
	require.NoError(t, err)
	_, err = f.store.Share.GetByHash("sibling")
	require.NoError(t, err)
}

func TestPublicShareKeepsOriginalAccessRules(t *testing.T) {
	f := newAPIFixture(t, "")
	require.NoError(t, f.fs.MkdirAll("/shared", 0755))
	require.NoError(t, afero.WriteFile(f.fs, "/shared/secret.txt", []byte("private"), 0644))
	config, err := f.store.Settings.Get()
	require.NoError(t, err)
	config.Rules = []rules.Rule{{Path: "/shared/secret.txt", Allow: false}}
	require.NoError(t, f.store.Settings.Save(config))
	require.NoError(t, f.store.Share.Save(&share.Link{Hash: "folder", UserID: 1, Path: "/shared"}))
	response := f.request(t, "GET", "/api/public/share/folder", "")
	require.Equal(t, 200, response.Code)
	require.NotContains(t, response.Body.String(), "secret.txt")
	require.Equal(t, 403, f.request(t, "GET", "/api/public/dl/folder/secret.txt", "").Code)
}

func TestResumableUploadPreservesOriginalUntilComplete(t *testing.T) {
	f := newAPIFixture(t, "")
	require.NoError(t, afero.WriteFile(f.fs, "/file.txt", []byte("original"), 0644))
	require.Equal(t, 400, f.request(t, "POST", "/api/tus/file.txt?override=true", "", map[string]string{"Upload-Length": "-1"}).Code)
	require.Equal(t, 201, f.request(t, "POST", "/api/tus/file.txt?override=true", "", map[string]string{"Upload-Length": "6"}).Code)
	content, err := afero.ReadFile(f.fs, "/file.txt")
	require.NoError(t, err)
	require.Equal(t, "original", string(content))
	headers := map[string]string{"Content-Type": "application/offset+octet-stream", "Upload-Offset": "0"}
	require.Equal(t, 204, f.request(t, "PATCH", "/api/tus/file.txt", "abc", headers).Code)
	head := f.request(t, "HEAD", "/api/tus/file.txt", "")
	require.Equal(t, "3", head.Header().Get("Upload-Offset"))
	require.Equal(t, 409, f.request(t, "PATCH", "/api/tus/file.txt", "abc", headers).Code)
	headers["Upload-Offset"] = "3"
	require.Equal(t, 400, f.request(t, "PATCH", "/api/tus/file.txt", "defTOO-LONG", headers).Code)
	require.Equal(t, "3", f.request(t, "HEAD", "/api/tus/file.txt", "").Header().Get("Upload-Offset"))
	require.Equal(t, 204, f.request(t, "PATCH", "/api/tus/file.txt", "def", headers).Code)
	content, err = afero.ReadFile(f.fs, "/file.txt")
	require.NoError(t, err)
	require.Equal(t, "abcdef", string(content))
	require.Equal(t, 201, f.request(t, "POST", "/api/tus/file.txt?override=true", "", map[string]string{"Upload-Length": "10"}).Code)
	require.Equal(t, 204, f.request(t, "DELETE", "/api/tus/file.txt", "").Code)
	content, err = afero.ReadFile(f.fs, "/file.txt")
	require.NoError(t, err)
	require.Equal(t, "abcdef", string(content))
	require.Equal(t, 201, f.request(t, "POST", "/api/tus/empty.txt", "", map[string]string{"Upload-Length": "0"}).Code)
	empty, err := afero.ReadFile(f.fs, "/empty.txt")
	require.NoError(t, err)
	require.Empty(t, empty)
}

func TestPublicSettingsAndSignup(t *testing.T) {
	f := newAPIFixture(t, "")
	trailing := f.request(t, "GET", "/api/public/settings/", "")
	require.Equal(t, 200, trailing.Code)
	require.Contains(t, trailing.Header().Get("Content-Type"), "application/json")
	response := f.request(t, "GET", "/api/public/settings", "")
	require.Equal(t, 200, response.Code)
	require.Empty(t, response.Header().Get("Location"))
	var public publicSettingsData
	require.NoError(t, json.Unmarshal(response.Body.Bytes(), &public))
	require.Equal(t, "Original", public.Branding.Name)
	require.Equal(t, uint(12), public.MinimumPasswordLength)
	config, err := f.store.Settings.Get()
	require.NoError(t, err)
	config.Signup = true
	require.NoError(t, f.store.Settings.Save(config))
	require.Equal(t, 200, f.request(t, "POST", "/api/signup", `{"username":"registered","password":"Registered-strong-47"}`).Code)
	user, err := f.store.Users.Get("", "registered")
	require.NoError(t, err)
	require.False(t, user.Perm.Admin)
	require.Equal(t, 200, f.request(t, "POST", "/api/login", `{"username":"registered","password":"Registered-strong-47"}`).Code)
	require.Equal(t, 409, f.request(t, "POST", "/api/signup", `{"username":"registered","password":"Registered-strong-47"}`).Code)
}
