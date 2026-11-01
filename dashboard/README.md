# Keysy dashboard

React and TypeScript application built with Vite and Bun.

## Sign-in

The screen uses [1.1 Sign in](https://www.figma.com/design/i1pA349chi1nTE88kWTR1e?node-id=112-3342)
as its design reference.

- Continue with Google opens `/v0/auth/google` on the same origin.
- The auth service handles the Google callback and sets encrypted HttpOnly cookies.
- On each page load, `/v0/auth/session` verifies the access token on the server.
- The dashboard shows the verified user's email. It does not read or store tokens.
- Logout revokes the current session and clears the auth cookies through `/v0/auth/logout`.
- Logout shows a pending state and allows retry after a failure. Refresh is not implemented.

The browser does not call Supabase directly.
Status, Privacy, and Terms remain non-interactive placeholders until their public URLs are available.
The Keysy symbol, Google symbol, and dot tile in `src/assets/sign-in/` were exported from this Figma screen.

## Development

```sh
bun install --frozen-lockfile
bun run dev
```

Vite uses `http://localhost:5173` and proxies `/v0/auth` to `http://localhost:8080`.
Run the [auth service](../auth/README.md) with `AUTH_URL=http://localhost:5173`
and `WEB_APP_URL=http://localhost:5173/`. Register the callback URL
`http://localhost:5173/v0/auth/callback` in Google.

In production, route `/v0/auth` on the dashboard origin to the auth service.
Host-only cookies are not shared across subdomains.

## Verification

```sh
bun run lint
bun run build
bun run test
```
