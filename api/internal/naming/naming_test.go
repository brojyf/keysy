package naming

import (
	"strings"
	"testing"
)

func TestValid(t *testing.T) {
	for _, tc := range []struct {
		name string
		in   string
		want bool
	}{
		{name: "one rune", in: "a", want: true},
		{name: "32 runes", in: strings.Repeat("é", 32), want: true},
		{name: "empty", in: "", want: false},
		{name: "33 runes", in: strings.Repeat("é", 33), want: false},
		{name: "NUL", in: "a\x00b", want: false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if got := Valid(tc.in); got != tc.want {
				t.Fatalf("Valid(%q) = %v", tc.in, got)
			}
		})
	}
}
