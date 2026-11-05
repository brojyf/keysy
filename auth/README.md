# Keysy auth

Go and Gin service for server-side Google sign-in. The browser visits Keysy
and Google. Auth handles token exchanges with Supabase; the API fetches
Supabase JWKS for local JWT verification.

## Routes

| Method and path | Purpose |
|---|---|
| `GET /v0/auth/google` | Start Google sign-in with state, PKCE S256, and an OIDC nonce. |
| `GET /v0/auth/callback` | Exchange the authorization code, set token cookies, and redirect to `WEB_APP_URL`. |
| `POST /v0/auth/logout` | Revoke the current Supabase session and clear all three cookies. |
| `OPTIONS /v0/auth/logout` | Validate the dashboard origin and requested method for CORS preflight. |
| `POST /v0/auth/refresh` | Exchange the refresh cookie with Supabase and set new access and refresh cookies. |
| `OPTIONS /v0/auth/refresh` | Validate the dashboard origin and requested method for CORS preflight. |

The logout and refresh routes allow credentialed CORS requests only from the
exact origin of `WEB_APP_URL`. Responses include `Access-Control-Allow-Origin`,
`Access-Control-Allow-Credentials: true`, and `Vary: Origin`, including error
responses for the allowed origin. Other origins, including sibling subdomains,
are rejected before any Supabase request. Preflight allows only POST for logout and refresh, with no custom request headers. Login and callback are
browser navigations, not CORS endpoints. Logout and refresh always require the dashboard origin.

Logout requires an `Origin` header that matches the origin of `WEB_APP_URL`.
It takes no body or query parameters. It uses Supabase's `scope=local`, so it
does not sign out other devices. A missing, invalid, or expired credential
still permits local cookie cleanup. Without a valid access cookie, logout uses
the refresh cookie to get an access token, then revokes the session. If Supabase is unavailable, logout returns
503 and retains the cookies so the user can retry. Already issued JWTs can
remain valid until their expiry even after session revocation.

Refresh takes no body or query parameters. Supabase rotates the refresh token
on each use and accepts the old token again only within its reuse interval
(10 seconds by default), so concurrent refreshes from several tabs succeed.
A missing or rejected refresh token returns 401 `SESSION_EXPIRED` and clears all
three cookies. If Supabase is unavailable, refresh returns 503 and keeps the
cookies. The access token lifetime is a Supabase project setting; the access
cookie uses Supabase's `expires_in`.
The dashboard reads the current user from the API at `GET /v0/me`.

## Cookies

All three cookies use AES-256-GCM with random nonces and the cookie name as
additional authenticated data. Token cookies cannot be swapped or altered.
Their values use unpadded URL-safe Base64 encoding.

| Cookie | Contents | Lifetime |
|---|---|---|
| `__Host-keysy-oauth` | State, PKCE verifier, nonce, and issue time | 10 minutes; cleared on callback |
| `__Secure-keysy-access` | Supabase access token | Supabase's `expires_in` |
| `__Host-keysy-refresh` | Supabase refresh token | Browser session cookie |

HTTPS cookies use `HttpOnly; Secure; SameSite=Lax; Path=/`. The access cookie
uses `Domain=<COOKIE_DOMAIN>` (`keysy.net` in production), so the API can read it.
Refresh and OAuth cookies remain host-only, with no Domain. Browser origins must
remain on the same site. On localhost, cookies are shared across ports.
The access cookie always uses `__Secure-keysy-access` as AES-GCM AAD, even when
the local browser cookie is named `keysy-access`.

The callback checks the complete serialized size after encryption and rejects
cookies larger than 4096 bytes without issuing a partial session.

For local HTTP development only, `AUTH_URL=http://localhost:<port>` removes
`Secure`, Domain, and the `__Host-` / `__Secure-` prefixes. Other HTTP hosts are not allowed by configuration.
Supabase URLs must always use HTTPS.

## Configuration

Use the variables listed in `.env.example`. Export them before running the
service directly; it does not load environment files automatically. For local
development, Air loads the ignored `.env.local` file.

`COOKIE_DOMAIN` is required for HTTPS auth, must be a bare domain without a
scheme, port, or leading dot, and must equal or contain the auth hostname.
Set it to `keysy.net` in production and leave it empty for HTTP localhost.

`OAUTH_COOKIE_KEY` is a Base64-encoded, random 32-byte key used for all three
cookies. All auth and API replicas must use the same key. Generate one with:

```sh
openssl rand -base64 32
```

Keep the key in a secret store. Do not commit its value. Replacing the key
invalidates existing encrypted cookies. Users with older plaintext token
cookies must sign in again after this change.

For local development, use `AUTH_URL=http://localhost:8080` and
`WEB_APP_URL=http://localhost:5173/`. Register
`http://localhost:8080/v0/auth/callback` in Google. Run the service on port 8080
and the dashboard's Next.js development server on port 5173. The dashboard calls
the auth port directly with `credentials: 'include'`; there is no auth rewrite.

For production, set `AUTH_URL=https://auth.keysy.net` and
`WEB_APP_URL=https://dashboard.keysy.net/`. The dashboard's `.env.production`
sets `NEXT_PUBLIC_AUTH_URL`. Route the auth hostname to this
service and the dashboard hostname to Next.js. Both can run behind one proxy on
the same Fly Machine; sharing a Machine does not make their browser origins equal.
The browser navigates to the auth origin to start login, returns to the auth
origin for the callback, then redirects to the dashboard. The dashboard calls
the API origin for `/v0/me` and the auth origin for refresh and logout requests.
Register `https://auth.keysy.net/v0/auth/callback` in Google and configure the
same Google client in Supabase.

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
