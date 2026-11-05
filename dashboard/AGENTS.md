<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md

This file provides guidance to coding agents when working with code in this directory.

## Role

`dashboard` is Keysy's web application (Next.js App Router, React, TypeScript 7,
Bun). It is a client of the Go [auth service](../auth/AGENTS.md). It never calls
Supabase and never reads or stores tokens.

## Commands

Run from `dashboard/`:

```sh
bun install --frozen-lockfile
bun run dev        # http://localhost:5173, Fast Refresh; auth defaults to http://localhost:8080
bun run lint       # oxlint
NEXT_PUBLIC_AUTH_URL=https://auth.keysy.net bun run build   # tsc --noEmit, then next build
bun run test       # node --test tests/*.test.ts, then bun test on the .tsx tests
node --test tests/next-config.test.ts                  # one Node test file
bun test tests/session-gate.test.tsx -t "<test name>"   # one session-gate test
```

CI (`.github/workflows/ci.yml`, job `Dashboard`) runs lint, the build with
`NEXT_PUBLIC_AUTH_URL=https://auth.keysy.net`, the tests, and `bun test` in
`design/tokens`.

## Architecture

- `src/app/layout.tsx` wraps every route in `SessionGate`
  (`src/components/session-gate.tsx`), a Client Component. It calls
  `{NEXT_PUBLIC_AUTH_URL}/v0/auth/session` with `credentials: 'include'`.
  On 401 it shows the sign-in screen. On success it shows the shell (`Topbar`,
  `Rail`, page content). Logout calls `/v0/auth/logout` the same way.
  There is no Next.js middleware or server-side session check.
- The auth service owns the session. Its cookies stay on the auth host, so
  the dashboard cannot read them. Do not add rewrites or proxies for auth paths;
  the browser calls the auth origin directly through credentialed CORS.
- `NEXT_PUBLIC_AUTH_URL` is embedded at build time. `next.config.ts` requires
  it for production builds and accepts only an HTTPS origin (or HTTP localhost)
  with no path, query, or fragment. Never put a server secret in a
  `NEXT_PUBLIC_*` variable.
- Route pages under `src/app/` are stubs, except `/account`, which renders mock
  data from `src/app/account/mock-account.ts`. `/` redirects to `/secrets`.
- Styling is plain CSS. Tokens in `src/app/globals.css` use Tailwind v4
  namespace names (`--color-*`, `--text-*`, `--radius-*`), but Tailwind is not
  installed. Color values must match `design/tokens/tokens.css` (light mode only).
  The Figma design reference is in `design/dashboard/README.md`.
- File names are kebab-case. Shared UI lives in `src/components/`.
- Tests use `bun:test` with happy-dom. They mock `next/navigation` and `fetch`.
