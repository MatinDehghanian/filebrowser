package rules

import (
	"path/filepath"
	"regexp"
	"strings"
	"sync"
)

// Checker is a Rules checker.
type Checker interface {
	Check(path string) bool
}

// Rule is a allow/disallow rule.
type Rule struct {
	Regex  bool    `json:"regex"`
	Allow  bool    `json:"allow"`
	Path   string  `json:"path"`
	Regexp *Regexp `json:"regexp"`
}

// MatchHidden matches paths with a basename
// that begins with a dot.
func MatchHidden(path string) bool {
	return path != "" && strings.HasPrefix(filepath.Base(path), ".")
}

// Matches matches a path against a rule.
func (r *Rule) Matches(path string) bool {
	if r.Regex {
		return r.Regexp.MatchString(path)
	}

	return strings.HasPrefix(path, r.Path)
}

// Regexp is a wrapper to the native regexp type where we
// save the raw expression.
type Regexp struct {
	Raw    string `json:"raw"`
	regexp *regexp.Regexp
	once   sync.Once
}

// MatchString checks if a string matches the regexp.
func (r *Regexp) MatchString(s string) bool {
	if r == nil {
		return false
	}
	r.once.Do(func() { r.regexp, _ = regexp.Compile(r.Raw) })
	if r.regexp == nil {
		return false
	}

	return r.regexp.MatchString(s)
}
