package search

import (
	"context"
	"os"
	"sort"
	"testing"

	"github.com/spf13/afero"
)

type allowAll struct{}

func (allowAll) Check(string) bool { return true }

func searchNames(t *testing.T, query string) []string {
	t.Helper()
	fs := afero.NewMemMapFs()
	for _, name := range []string{
		"/docs/Report Final.md",
		"/docs/report-2026.txt",
		"/photos/holiday report.jpg",
		"/notes.md",
	} {
		if err := afero.WriteFile(fs, name, []byte("x"), 0o644); err != nil {
			t.Fatal(err)
		}
	}

	var found []string
	err := Search(context.Background(), fs, "/", query, allowAll{}, func(p string, _ os.FileInfo) error {
		found = append(found, p)
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	sort.Strings(found)
	return found
}

func TestSearchRequiresEveryTerm(t *testing.T) {
	got := searchNames(t, "report final")
	if len(got) != 1 || got[0] != "docs/Report Final.md" {
		t.Fatalf("got %v, want only docs/Report Final.md", got)
	}
}

func TestSearchIgnoresRepeatedSpaces(t *testing.T) {
	got := searchNames(t, "report   final ")
	if len(got) != 1 {
		t.Fatalf("got %v, want a single match", got)
	}
}

func TestSearchSingleTerm(t *testing.T) {
	got := searchNames(t, "report")
	if len(got) != 3 {
		t.Fatalf("got %v, want 3 matches", got)
	}
}
