package fbhttp

import (
	"log"
	"net/http"
	pathpkg "path"
	"strconv"
	"strings"

	"github.com/tomasen/realip"

	"github.com/MatinDehghanian/filebrowser/v2/rules"
	"github.com/MatinDehghanian/filebrowser/v2/runner"
	"github.com/MatinDehghanian/filebrowser/v2/settings"
	"github.com/MatinDehghanian/filebrowser/v2/storage"
	"github.com/MatinDehghanian/filebrowser/v2/users"
)

type handleFunc func(w http.ResponseWriter, r *http.Request, d *data) (int, error)

type data struct {
	*runner.Runner
	settings    *settings.Settings
	server      *settings.Server
	store       *storage.Storage
	user        *users.User
	scopePrefix string
	raw         interface{}
}

// Check implements rules.Checker.
func (d *data) Check(path string) bool {
	if strings.HasPrefix(pathpkg.Base(path), ".filebrowser-tus-") {
		return false
	}
	if d.scopePrefix != "" {
		path = pathpkg.Join(d.scopePrefix, path)
	}
	if d.user.HideDotfiles && rules.MatchHidden(path) {
		return false
	}

	allow := true
	for _, rule := range d.settings.Rules {
		if rule.Matches(path) {
			allow = rule.Allow
		}
	}

	for _, rule := range d.user.Rules {
		if rule.Matches(path) {
			allow = rule.Allow
		}
	}

	return allow
}

func handle(fn handleFunc, prefix string, store *storage.Storage, server *settings.Server) http.Handler {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		for k, v := range globalHeaders {
			w.Header().Set(k, v)
		}

		settings, err := store.Settings.Get()
		if err != nil {
			log.Printf("ERROR: couldn't get settings: %v", err)
			http.Error(w, "Unable to load settings", http.StatusInternalServerError)
			return
		}

		status, err := fn(w, r, &data{
			Runner:   &runner.Runner{Enabled: server.EnableExec, Settings: settings},
			store:    store,
			settings: settings,
			server:   server,
		})

		if status >= 400 || err != nil {
			clientIP := realip.FromRequest(r)
			log.Printf("%s: %v %s %v", r.URL.Path, status, clientIP, err)
		}

		if status >= 400 {
			txt := http.StatusText(status)
			if status == http.StatusBadRequest && err != nil {
				txt += " (" + err.Error() + ")"
			}
			http.Error(w, strconv.Itoa(status)+" "+txt, status)
			return
		}
		if status != 0 {
			w.WriteHeader(status)
		}
	})

	return stripPrefix(prefix, handler)
}
