package search

import (
	"context"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/spf13/afero"

	"github.com/MatinDehghanian/filebrowser/v2/rules"
)

type searchOptions struct {
	CaseSensitive bool
	Conditions    []condition
	Terms         []string
}

// Search searches for a query in a fs.
func Search(ctx context.Context,
	fs afero.Fs, scope, query string, checker rules.Checker, found func(path string, f os.FileInfo) error) error {
	search := parseSearch(query)

	scope = filepath.ToSlash(filepath.Clean(scope))
	scope = path.Join("/", scope)

	return afero.Walk(fs, scope, func(fPath string, f os.FileInfo, walkErr error) error {
		if ctx.Err() != nil {
			return context.Cause(ctx)
		}
		if walkErr != nil {
			if fPath == scope {
				return walkErr
			}
			return nil
		}
		fPath = filepath.ToSlash(filepath.Clean(fPath))
		fPath = path.Join("/", fPath)
		relativePath := strings.TrimPrefix(fPath, scope)
		relativePath = strings.TrimPrefix(relativePath, "/")

		if fPath == scope {
			return nil
		}

		if !checker.Check(fPath) {
			if f.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}

		if len(search.Conditions) > 0 {
			match := false

			for _, t := range search.Conditions {
				if t(fPath) {
					match = true
					break
				}
			}

			if !match {
				return nil
			}
		}

		// Every term must appear in the file name, so adding words narrows
		// the results instead of widening them.
		_, fileName := path.Split(fPath)
		if !search.CaseSensitive {
			fileName = strings.ToLower(fileName)
		}
		for _, term := range search.Terms {
			if !search.CaseSensitive {
				term = strings.ToLower(term)
			}
			if !strings.Contains(fileName, term) {
				return nil
			}
		}

		return found(relativePath, f)
	})
}
