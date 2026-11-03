# Keysy API

Go, Gin, and GORM service. `GET /v0/me` returns the authenticated user's ID,
email, profile display name, optional Google avatar, and empty memberships.
A missing profile row is an internal error. This service does not refresh sessions.

## Configuration

Copy `.env.example` to ignored `.env.local` for Air. Direct runs require exported
variables. `PORT` defaults to 8081. `DATABASE_URL` must be a PostgreSQL URL with
permission to read `public.profiles`. Use Supabase's direct or session pooler
connection (port 5432); the transaction pooler (port 6543) breaks prepared statements. `SUPABASE_URL` requires HTTPS.
`WEB_APP_URL` requires HTTPS except `http://localhost`; its exact origin is
allowed for credentialed GET requests and OPTIONS preflight.
`OAUTH_COOKIE_KEY` must decode from Base64 to 32 bytes and match auth's key.
Never commit secrets.

Production uses `https://api.keysy.net` and `https://dashboard.keysy.net/`.
Set the dashboard build variable `NEXT_PUBLIC_API_URL=https://api.keysy.net`.
Local development uses `http://localhost:8081` and `http://localhost:5173/`.

The API reads only the sealed `__Secure-keysy-access` cookie, or `keysy-access`
when `WEB_APP_URL` is HTTP localhost. Both use `__Secure-keysy-access` as AES-GCM
AAD. JWT verification uses cached Supabase JWKS at
`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`, requires ES256, the Supabase
`/auth/v1` issuer, `authenticated` audience, and expiration. Bearer tokens are
not accepted. Responses use `Cache-Control: no-store`.

## Run and verify

Install Air with `go install github.com/air-verse/air@v1.67.4`, then run `air`.
Air loads `.env.local` and rebuilds into ignored `tmp/`. Do not overwrite an
existing local file or regenerate the shared cookie key on restart.

```sh
go run .
gofmt -l .
go vet ./...
go test -race -cover ./...
go build ./...
```

Middleware order: telemetry → recovery → requestid → log → timeout → CORS → session → handler.
Request IDs are always new UUIDs. JSON logs go to stdout and contain only
request_id, user_id, method, route template, status, and duration_ms. The fixed
10-second timeout cancels the request context; it does not interrupt handlers or
replace an already written response. Database queries use that context.
When `OTEL_EXPORTER_OTLP_ENDPOINT` is set, the service exports traces, metrics,
and logs over OTLP/HTTP to the collector in `../otel`. Without it, nothing is
exported. Server spans and the `http.server.request.duration` histogram carry
only the method, route template, status, and request ID. JWKS fetches and
database queries (without query variables) are child spans. Incoming trace
headers are ignored and outgoing requests carry none. Logs keep going to stdout.
Tests use local JWKS servers and fake profile lookups, with no live services.
