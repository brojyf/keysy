# AGENTS.md

This file provides guidance to coding agents when working with code in this directory.

## Role

`auth` is Keysy's authentication service (Go and Gin). It signs users in with
Google and manages their sessions. Supabase Auth is the identity store, but
clients never call Supabase directly: only this service talks to Supabase Auth.
The browser visits only Keysy and Google.

The service is planned to serve the dashboard, the CLI, and the browser
extension. The dashboard is the only client today. `openapi/auth.yaml`
documents the HTTP API; keep it in sync when routes, status codes, or error
codes change. `README.md` covers cookies, configuration, and local setup.

## Commands

Run from `auth/`:

```sh
air                          # dev: loads .env.local, rebuilds and restarts on :8080
go run .                     # direct run; export env vars first (no .env loading)
go test -race -cover ./...
go test -race ./internal/login -run TestName   # single test
go vet ./...
go build ./...
gofmt -l .
```

CI (`.github/workflows/ci.yml`, job `Auth`) runs `go test -race`, `go vet`, and
`go build`. Tests use local fake Google and Supabase servers; nothing calls live
services.

## Architecture

- `main.go` wires configuration, the Google OAuth client, and the Gin router.
  It uses telemetry, recovery, generated request IDs, and JSON request logs with route
  templates only, because callback URLs carry authorization codes. When
  `OTEL_EXPORTER_OTLP_ENDPOINT` is set, spans, metrics, and logs go to `../otel`;
  spans carry the same fields as the request log. No propagator is set, so
  Supabase and Google never receive trace headers. It trusts no proxies and sets strict server timeouts.
- `internal/config` reads environment variables and rejects unsafe values at
  startup. Browser URLs (`AUTH_URL`, `WEB_APP_URL`) must be HTTPS, except
  `http://localhost`. `SUPABASE_URL` must always be HTTPS.
  `OAUTH_COOKIE_KEY` must decode to 32 bytes.
- `internal/login` holds all HTTP behavior on one `Handler`:
  - Sign-in is a server-side authorization code flow with state, PKCE S256, and
    a hashed OIDC nonce. The transaction lives in a ten-minute encrypted cookie.
  - The callback exchanges the Google code, then passes the Google ID token to
    Supabase (`supabase.go`) to create the Supabase session.
  - Supabase access and refresh tokens never reach browser JavaScript. They are
    stored in encrypted `HttpOnly` cookies (AES-256-GCM, random nonce, cookie
    name as additional authenticated data).
  - The dashboard reads the current user from the API's `GET /v0/me` route.
  - `POST /v0/auth/logout` revokes only the current Supabase session
    (`scope=local`) and clears all auth cookies.
  - Credentialed CORS is allowed only for logout, and only from the
    exact origin of `WEB_APP_URL`.

## Invariants

Keep these unless the user approves a design change:

- Auth and dashboard are different origins on the same site
  (`auth.keysy.net`, `dashboard.keysy.net`). The access cookie is `__Secure-keysy-access` with `Domain=keysy.net`.
  Refresh and OAuth cookies remain host-only with the `__Host-` prefix. All
  cookies use `Secure`, `HttpOnly`, and `SameSite=Lax`. Only HTTP localhost
  drops `Secure` and both prefixes, with no Domain. `COOKIE_DOMAIN` must be
  empty locally and must contain the auth host in production.
- Reject a bad origin, method, header, or cookie before any Supabase call.
- Do not put tokens, authorization codes, or upstream error text in response
  bodies or logs. Sensitive responses use `no-store` and `no-referrer`.
  The HTTP client does not follow upstream redirects.
- All replicas share one `OAUTH_COOKIE_KEY`. Changing it invalidates all
  existing cookies.
- Session refresh is not implemented. An expired access token requires a new
  sign-in.
