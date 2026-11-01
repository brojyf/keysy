# Keysy dashboard

Next.js App Router application with React, TypeScript 7, and Bun.
The sign-in screen is a Client Component. The Go auth service remains responsible for authentication.

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
The symbols in `public/sign-in/` and the dot tile in `src/assets/sign-in/` were exported from this Figma screen.

## Development

```sh
bun install --frozen-lockfile
bun run dev
```

The Next.js development server uses `http://localhost:5173` and rewrites
`/v0/auth` to `http://localhost:8080` without changing the browser's URL.
`bun run dev` includes Fast Refresh (HMR). Save a component or stylesheet to update
the page without a manual reload. Compatible component changes preserve React state;
some changes require a full reload.
Run the [auth service](../auth/README.md) with `AUTH_URL=http://localhost:5173`
and `WEB_APP_URL=http://localhost:5173/`. Register the callback URL
`http://localhost:5173/v0/auth/callback` in Google.

## Production

```sh
bun run build
bun run start
```

The production application requires a Next.js server; `.next/` is not a static
site export. `bun run start` uses port 5173. The local auth rewrite is development-only.
In production, route `/v0/auth` on the dashboard origin to the Go auth service
through the deployment proxy. Host-only cookies are not shared across subdomains.

## Verification

```sh
bun run lint
bun run build
bun run test
```
