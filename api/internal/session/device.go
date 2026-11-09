package session

import "github.com/mileusna/useragent"

// deviceName labels a session as "<Browser> on <OS>" from its user agent.
func deviceName(userAgent string) string {
	parsed := useragent.Parse(userAgent)
	if parsed.Bot || parsed.Name == "" || parsed.OS == "" {
		return "Unknown device"
	}
	return parsed.Name + " on " + parsed.OS
}
