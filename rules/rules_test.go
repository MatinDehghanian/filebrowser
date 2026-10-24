package rules

import "testing"

func TestMatchHidden(t *testing.T) {
	cases := map[string]bool{
		"/":                   false,
		"/src":                false,
		"/src/":               false,
		"/.circleci":          true,
		"/a/b/c/.docker.json": true,
		".docker.json":        true,
		"Dockerfile":          false,
		"/Dockerfile":         false,
	}

	for path, want := range cases {
		got := MatchHidden(path)
		if got != want {
			t.Errorf("MatchHidden(%s)=%v; want %v", path, got, want)
		}
	}
}

func TestInvalidRegexDoesNotPanic(t *testing.T) {
	rule := Rule{Regex: true, Regexp: &Regexp{Raw: "[invalid"}}
	if rule.Matches("/file") {
		t.Fatal("invalid expression must not match")
	}
	rule.Regexp = nil
	if rule.Matches("/file") {
		t.Fatal("missing expression must not match")
	}
}
