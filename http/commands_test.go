package fbhttp

import (
	"net/http"
	"net/http/httptest"
	"os/exec"
	"strings"
	"testing"
	"testing/fstest"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/require"

	"github.com/MatinDehghanian/filebrowser/v2/settings"
)

func TestCommandStreamsStdoutAndStderrAndClosesNormally(t *testing.T) {
	if _, err := exec.LookPath("sh"); err != nil {
		t.Skip("sh is not installed")
	}
	f := newAPIFixture(t, "")
	f.user.Perm.Execute = true
	f.user.Commands = []string{"sh"}
	require.NoError(t, f.store.Users.Update(f.user, "Perm", "Commands"))
	handler, err := NewHandler(nil, testCache{}, nil, f.store, &settings.Server{EnableExec: true}, fstest.MapFS{})
	require.NoError(t, err)
	server := httptest.NewServer(handler)
	defer server.Close()
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, authToken{User: userInfo{ID: f.user.ID}, RegisteredClaims: jwt.RegisteredClaims{ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour))}}).SignedString(f.key)
	require.NoError(t, err)
	conn, response, err := websocket.DefaultDialer.Dial("ws"+strings.TrimPrefix(server.URL, "http")+"/api/command/", http.Header{"X-Auth": {token}})
	if response != nil {
		defer response.Body.Close()
	}
	require.NoError(t, err)
	defer conn.Close()
	require.NoError(t, conn.SetReadDeadline(time.Now().Add(15*time.Second)))
	require.NoError(t, conn.WriteMessage(websocket.TextMessage, []byte(`sh -c 'i=0; while [ "$i" -lt 8000 ]; do echo stderr-line >&2; i=$((i+1)); done; echo complete'`)))
	lines := 0
	complete := false
	for {
		_, message, readErr := conn.ReadMessage()
		if readErr != nil {
			require.True(t, websocket.IsCloseError(readErr, websocket.CloseNormalClosure), "%v", readErr)
			break
		}
		lines++
		if string(message) == "complete" {
			complete = true
		}
	}
	require.Equal(t, 8001, lines)
	require.True(t, complete)
}
