# AGENTS.md

`api` is Keysy's application API (Go, Gin, GORM). Keep the service small:
configuration, middleware, the me handler, and profile lookup and update. `PATCH /v0/me` updates the display name.
`DATABASE_URL` needs SELECT and UPDATE on `public.profiles`. CORS allows GET
and PATCH with only the `Content-Type` request header. Use English for
all repository content. Keep `../openapi/api.yaml` in sync with `/v0/me`.

Run `gofmt -l .`, `go vet ./...`, `go test -race -cover ./...`, and
`go build ./...`. Air loads ignored `.env.local` and serves on port 8081.
CI's API job runs race tests, vet, and build. Tests must not call live services.

Keep telemetry → recovery → requestid → log → timeout → CORS → session → handler order.
Telemetry spans and metrics follow the same rule as logs: method, route template,
status, and request ID only. Set no OpenTelemetry propagator.
Never log raw paths, queries, headers, cookies, bodies, or JWT errors. Trust no
incoming request ID or proxy. Authenticate only sealed access cookies with the
same key and full-name AAD as auth. Verify JWTs locally with cached JWKS and
strict ES256, issuer, audience, and expiration checks. Sensitive responses use
no-store. Use request contexts for GORM queries. Do not add refresh or org logic.
