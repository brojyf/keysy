# Keysy dashboard

Next.js App Router application with React, TypeScript 7, and Bun.
The sign-in screen is a Client Component. The Go auth service remains responsible for authentication.

## Sign-in

The screen uses [1.1 Sign in](https://www.figma.com/design/i1pA349chi1nTE88kWTR1e?node-id=112-3342)
as its design reference.

- Continue with Google navigates to `{NEXT_PUBLIC_AUTH_URL}/v0/auth/google`.
- The auth service handles the callback on its own origin, sets encrypted HttpOnly cookies, and redirects to the dashboard.
- On each page load, `{NEXT_PUBLIC_API_URL}/v0/me` verifies the access token on the server.
- The dashboard shows the verified user's display name, email, and optional Google avatar. It does not read or store tokens.
- Account General edits the display name with `PATCH /v0/me`.
- Logout revokes the current session and clears the auth cookies through `{NEXT_PUBLIC_AUTH_URL}/v0/auth/logout`.
- Logout shows a pending state and allows retry after a failure.
- A 401 from the API triggers one `{NEXT_PUBLIC_AUTH_URL}/v0/auth/refresh` call, then one retry. A rejected refresh shows sign-in; an unavailable one shows retry.

Session, refresh, and logout requests use `credentials: 'include'`. The API and auth services allow
credentialed CORS only from the configured dashboard origin, including on errors.
The access cookie uses the parent domain; refresh and OAuth cookies stay on the
auth hostname. All cookies remain HttpOnly. The production dashboard and auth origins must use HTTPS on the same site.
The browser does not call Supabase directly.
Status, Privacy, and Terms remain non-interactive placeholders until their public URLs are available.
The symbols in `public/` and the dot tile `src/components/sign-in-dots.png` were exported from this Figma screen.

## Development

```sh
bun install --frozen-lockfile
bun run dev
```

The Next.js development server uses `http://localhost:5173`. Auth requests go
directly to `http://localhost:8080`, the default when `NEXT_PUBLIC_AUTH_URL` is unset.
API requests go to `http://localhost:8081` when `NEXT_PUBLIC_API_URL` is unset.
Use `.env.example` as the reference for an ignored `.env.local` if you need to set
these public URLs. Do not overwrite an existing `.env.local`.
`bun run dev` includes Fast Refresh (HMR). Save a component or stylesheet to update
the page without a manual reload. Compatible component changes preserve React state;
some changes require a full reload.
Run the [auth service](../auth/README.md) with `AUTH_URL=http://localhost:8080`
and `WEB_APP_URL=http://localhost:5173/`. Register the callback URL
`http://localhost:8080/v0/auth/callback` in Google.

## Production

```sh
NEXT_PUBLIC_AUTH_URL=https://auth.keysy.net NEXT_PUBLIC_API_URL=https://api.keysy.net bun run build
bun run start
```

Production builds require `NEXT_PUBLIC_AUTH_URL` and `NEXT_PUBLIC_API_URL`. Each must be an HTTPS origin
(HTTP localhost is allowed for local checks), without credentials, a path, query,
or fragment. Next.js embeds these public values in the browser bundle at build time;
changing only the runtime environment will not change the service destinations.
Set `NEXT_PUBLIC_API_URL=https://api.keysy.net` at build time for production.
For container builds, provide it during the image build, not only through runtime
Fly Secrets. Never put a Supabase key or cookie encryption key in this variable.

The production application requires a Next.js server; `.next/` is not a static
site export. `bun run start` uses port 5173 and listens on localhost for a proxy in
the same Machine. Route `dashboard.keysy.net` to Next.js and `auth.keysy.net` to
the Go auth service. Do not proxy auth paths through the dashboard.
Set the auth service's `AUTH_URL=https://auth.keysy.net` and
`WEB_APP_URL=https://dashboard.keysy.net/`. Register
`https://auth.keysy.net/v0/auth/callback` in Google.

## Verification

```sh
bun run lint
NEXT_PUBLIC_AUTH_URL=https://auth.keysy.net NEXT_PUBLIC_API_URL=https://api.keysy.net bun run build
bun run test
```
