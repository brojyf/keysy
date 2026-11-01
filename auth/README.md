# Keysy auth

Go and Gin service for server-side Google sign-in. The browser visits Keysy
and Google. Only the auth service calls Supabase.

## Routes

| Method and path | Purpose |
|---|---|
| `GET /v0/auth/google` | Start Google sign-in with state, PKCE S256, and an OIDC nonce. |
| `GET /v0/auth/callback` | Exchange the authorization code, set token cookies, and redirect to `WEB_APP_URL`. |
| `GET /v0/auth/session` | Decrypt the access cookie, verify it with Supabase, and return the user's ID and optional email. |
| `POST /v0/auth/logout` | Revoke the current Supabase session and clear all three cookies. |

Logout requires an `Origin` header that matches the origin of `WEB_APP_URL`.
It takes no body or query parameters. It uses Supabase's `scope=local`, so it
does not sign out other devices. A missing, invalid, or expired credential
still permits local cookie cleanup. If Supabase is unavailable, logout returns
503 and retains the cookies so the user can retry. Already issued JWTs can
remain valid until their expiry even after session revocation.

Refresh is not implemented. An expired access token requires a new sign-in.
The session route never returns tokens to the browser.

## Cookies

All three cookies use AES-256-GCM with random nonces and the cookie name as
additional authenticated data. Token cookies cannot be swapped or altered.
Their values use unpadded URL-safe Base64 encoding.

| Cookie | Contents | Lifetime |
|---|---|---|
| `__Host-keysy-oauth` | State, PKCE verifier, nonce, and issue time | 10 minutes; cleared on callback |
| `__Host-keysy-access` | Supabase access token | Supabase's `expires_in` |
| `__Host-keysy-refresh` | Supabase refresh token | Browser session cookie |

HTTPS cookies use `HttpOnly; Secure; SameSite=Lax; Path=/` and no `Domain`.
The callback checks the complete serialized size after encryption and rejects
cookies larger than 4096 bytes without issuing a partial session.

For local HTTP development only, `AUTH_URL=http://localhost:<port>` removes
`Secure` and the `__Host-` prefix. Other HTTP hosts are not allowed by configuration.
Supabase URLs must always use HTTPS.

## Configuration

Use the variables listed in `.env.example`. Export them before running the
service directly; it does not load environment files automatically. For local
development, Air loads the ignored `.env.local` file.

`OAUTH_COOKIE_KEY` is a Base64-encoded, random 32-byte key used for all three
cookies. All auth replicas must use the same key. Generate one with:

```sh
openssl rand -base64 32
```

Keep the key in a secret store. Do not commit its value. Replacing the key
invalidates existing encrypted cookies. Users with older plaintext token
cookies must sign in again after this change.

For local development, use `AUTH_URL=http://localhost:5173` and
`WEB_APP_URL=http://localhost:5173/`. Register
`http://localhost:5173/v0/auth/callback` in Google. Run the service on port 8080
and the dashboard's Next.js development server on port 5173.

For production, route `/v0/auth` on the dashboard origin to this service and
set `AUTH_URL` to that HTTPS origin. Host-only cookies do not cross subdomains.
Register `{AUTH_URL}/v0/auth/callback` in Google and configure the same Google
client in Supabase.

## Development with Air

Install [Air](https://github.com/air-verse/air) as a development tool, not an
application dependency:

```sh
go install github.com/air-verse/air@v1.67.4
export PATH="$(go env GOPATH)/bin:$PATH"
```

From `auth/`, create `.env.local` from `.env.example` if it does not exist,
then set the local values. Do not overwrite an existing `.env.local` or generate
a new cookie key on each restart.

```sh
air
```

Air reads `.air.toml` and `.env.local`. It rebuilds and restarts the service on
port 8080 when Go source files, `go.mod`, `go.sum`, or `.env.local` change.
Test-only Go files are excluded. Air does not overwrite variables exported before
it starts. Build failures stop the old binary instead of serving stale code.
Generated binaries and build errors stay in the ignored `tmp/` directory.
Stop any existing service on port 8080 before starting Air.

This is process reload, not in-process HMR. In-memory state is lost on restart.
Cookies remain usable while `OAUTH_COOKIE_KEY` is unchanged. The dashboard's
Next.js development server keeps its own Fast Refresh connection; no Air browser
proxy is needed. Air is not used in production.

## Run and verify

Run directly without the development watcher (export configuration first):

```sh
go run .
```

```sh
go test -race -cover ./...
go vet ./...
go build ./...
```

Tests use local fake Google and Supabase servers. They do not verify live
credentials or a deployed Google sign-in flow.
