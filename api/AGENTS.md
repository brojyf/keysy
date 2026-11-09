# AGENTS.md

`api` is Keysy's application API (Go, Gin, GORM). Keep the service small:
configuration, middleware, profile lookup and update, session list/revoke, and
org list/create/delete.
`PATCH /v0/me` updates the display name or agent auto-apply preference.
`GET /v0/me/sessions` lists the current user's active web sessions from
`auth.sessions` and marks the current one by the JWT `session_id`.
`DELETE /v0/me/sessions/{sessionId}` deletes one of the user's other sessions.
The current session returns 409; missing and other users' sessions return 404.
Existing access tokens of a revoked session stay valid until they expire.
`GET /v0/orgs` lists the current user's active orgs, roles, and total member counts.
`POST /v0/orgs` creates the org and its owner membership in one transaction.
`DELETE /v0/orgs/{orgId}` sets deleted_at only for an active org owned by the user.
Memberships and user accounts remain. Owner retries on deleted orgs return 204
without another write. Missing and non-owner targets return 404.
`DATABASE_URL` needs SELECT and UPDATE on `public.profiles`, plus SELECT and
INSERT on `public.orgs` and `public.members`, UPDATE on `public.orgs`, and
EXECUTE on `public.list_user_sessions(uuid)` and
`public.revoke_user_session(uuid, uuid)`. The backend database role must
bypass RLS; direct client access remains blocked. CORS allows GET, POST,
PATCH, and DELETE with only the `Content-Type` request header. Use English for
all repository content. Keep `../openapi/api.yaml` in sync with implemented routes.

Run `gofmt -l .`, `go vet ./...`, `go test -race -cover ./...`, and
`go build ./...`. Air loads ignored `.env.local` and serves on port 8081.
CI's API job runs race tests, vet, and build. Tests must not call live services.
Set `KEYSY_TEST_DATABASE_URL` to an empty, isolated PostgreSQL database to run the
store integration test. CI supplies this database through its PostgreSQL service.

Keep telemetry → recovery → requestid → log → timeout → CORS → session → handler order.
Telemetry spans and metrics follow the same rule as logs: method, route template,
status, and request ID only. Set no OpenTelemetry propagator.
Never log raw paths, queries, headers, cookies, bodies, or JWT errors. Trust no
incoming request ID or proxy. Authenticate only sealed access cookies with the
same key and full-name AAD as auth. Verify JWTs locally with cached JWKS and
strict ES256, issuer, audience, and expiration checks. Sensitive responses use
no-store. Use request contexts for GORM queries. Do not add session refresh logic.
