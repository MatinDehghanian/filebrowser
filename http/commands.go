package fbhttp

import (
	"bufio"
	"io"
	"log"
	"net/http"
	"os/exec"
	"slices"
	"strings"
	"time"

	"github.com/gorilla/websocket"

	"github.com/MatinDehghanian/filebrowser/v2/runner"
)

const (
	WSWriteDeadline = 10 * time.Second
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

var (
	cmdNotAllowed = []byte("Command not allowed.")
)

func wsErr(ws *websocket.Conn, r *http.Request, status int, err error) {
	txt := http.StatusText(status)
	if err != nil || status >= 400 {
		log.Printf("%s: %v %s %v", r.URL.Path, status, r.RemoteAddr, err)
	}
	if err := ws.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseInternalServerErr, txt), time.Now().Add(WSWriteDeadline)); err != nil {
		log.Print(err)
	}
}

var commandsHandler = withUser(func(w http.ResponseWriter, r *http.Request, d *data) (int, error) {
	if !d.server.EnableExec || !d.user.Perm.Execute || !d.Check(r.URL.Path) {
		return http.StatusForbidden, nil
	}
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return http.StatusInternalServerError, err
	}
	defer conn.Close()

	var raw string

	for {
		_, msg, err := conn.ReadMessage()
		if err != nil {
			wsErr(conn, r, http.StatusInternalServerError, err)
			return 0, nil
		}

		raw = strings.TrimSpace(string(msg))
		if raw != "" {
			break
		}
	}

	command, name, err := runner.ParseCommand(d.settings, raw)
	if err != nil {
		if err := conn.WriteMessage(websocket.TextMessage, []byte(err.Error())); err != nil {
			wsErr(conn, r, http.StatusInternalServerError, err)
		}
		wsErr(conn, r, http.StatusBadRequest, err)
		return 0, nil
	}

	if !slices.Contains(d.user.Commands, name) {
		if err := conn.WriteMessage(websocket.TextMessage, cmdNotAllowed); err != nil {
			wsErr(conn, r, http.StatusInternalServerError, err)
		}
		wsErr(conn, r, http.StatusForbidden, nil)

		return 0, nil
	}

	cmd := exec.CommandContext(r.Context(), command[0], command[1:]...)
	cmd.Dir = d.user.FullPath(r.URL.Path)

	output, writer := io.Pipe()
	defer output.Close()
	defer writer.Close()
	// Drain stdout and stderr together, so a full stderr pipe cannot block
	// the command while the reader is waiting for stdout to reach EOF.
	cmd.Stdout = writer
	cmd.Stderr = writer

	if err := cmd.Start(); err != nil {
		wsErr(conn, r, http.StatusInternalServerError, err)
		return 0, nil
	}

	finished := make(chan error, 1)
	go func() {
		err := cmd.Wait()
		_ = writer.Close()
		finished <- err
	}()
	s := bufio.NewScanner(output)
	s.Buffer(make([]byte, 4096), 1024*1024)
	for s.Scan() {
		if err := conn.WriteMessage(websocket.TextMessage, s.Bytes()); err != nil {
			log.Print(err)
			_ = cmd.Process.Kill()
			_ = output.Close()
			if waitErr := <-finished; waitErr != nil {
				log.Printf("command exited after websocket write failure: %v", waitErr)
			}
			return 0, nil
		}
	}

	if err := s.Err(); err != nil {
		_ = cmd.Process.Kill()
		_ = output.Close()
		if waitErr := <-finished; waitErr != nil {
			log.Printf("command exited after stdout scan failure: %v", waitErr)
		}
		wsErr(conn, r, http.StatusInternalServerError, err)
		return 0, nil
	}
	if err := <-finished; err != nil {
		wsErr(conn, r, http.StatusInternalServerError, err)
		return 0, nil
	}
	_ = conn.WriteControl(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""), time.Now().Add(WSWriteDeadline))

	return 0, nil
})
