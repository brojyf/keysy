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
bun run build      # tsc --noEmit, then next build; URLs come from .env.production
bun run test       # node --test tests/*.test.ts, then bun test on the .tsx tests
node --test tests/next-config.test.ts                  # one Node test file
bun test tests/session-gate.test.tsx -t "<test name>"   # one session-gate test
```

CI (`.github/workflows/ci.yml`, job `Dashboard`) runs lint, the build, the
tests, and `bun test` in `design/tokens`.

## Architecture

- `src/lib/api-client.ts` is the entry point for API calls. Each request has a 20 second timeout.
- `src/app/layout.tsx` wraps every route in `SessionGate`
  (`src/components/session-gate.tsx`), a Client Component. It calls
  `{NEXT_PUBLIC_API_URL}/v0/me` with `credentials: 'include'`.
  On 401 it calls `{NEXT_PUBLIC_AUTH_URL}/v0/auth/refresh` once
  (`src/lib/session-refresh.ts`; concurrent 401s share one refresh) and
  retries. If refresh returns 401, it shows the sign-in screen. After `/v0/me`, it checks `/v0/orgs` with the same signal. On success it stores organizations. With none, `/organizations/new` shows the bare create page, `/account` and its descendants show the account-only shell, and other paths redirect to `/organizations/new`. With organizations, `/organizations/new` redirects to `/secrets` and other paths show the full shell (`Topbar`, `Rail`, page content). Logout calls `/v0/auth/logout` the same way.
  There is no Next.js middleware or server-side session check.
- The auth service owns the session. Its access cookie is shared with the API domain and remains HttpOnly, so
  the dashboard cannot read them. Do not add rewrites or proxies for auth paths;
  the browser calls the auth origin directly through credentialed CORS.
- `NEXT_PUBLIC_AUTH_URL` and `NEXT_PUBLIC_API_URL` are embedded at build time. `.env.production` sets
  both for `next build`. `next.config.ts` requires both for production builds and accepts only an HTTPS origin (or HTTP localhost)
  with no path, query, or fragment. Never put a server secret in a
  `NEXT_PUBLIC_*` variable.
- Route pages under `src/app/` are stubs, except `/account`: General uses the session user and `PATCH /v0/me`; Organizations uses `/v0/orgs` data; Sessions uses mock data. Both use local search and sort. `/` redirects to `/secrets`.
- Styling is plain CSS. Tokens live in `design/tokens/tokens.css`, which
  `src/app/globals.css` imports. Tailwind is not installed.
  Read `design/tokens/` before any UI or styling change.
  The Figma design reference is in `design/dashboard/README.md`.
- File names are kebab-case. Shared UI lives in `src/components/`.
- Tests use `bun:test` with happy-dom. They mock `next/navigation` and `fetch`.
