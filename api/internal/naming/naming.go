// Package naming holds the rules shared by user-chosen names, such as display names and org names.
package naming

import (
	"strings"
	"unicode/utf8"
)

// Valid reports whether a trimmed name has 1 to 32 runes and no NUL, which Postgres text rejects.
func Valid(name string) bool {
	n := utf8.RuneCountInString(name)
	return n >= 1 && n <= 32 && !strings.ContainsRune(name, '\x00')
}
