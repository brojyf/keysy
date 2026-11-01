# Keysy dashboard

React and TypeScript application built with Vite and Bun.

## Sign-in prototype

Implement [1.1 Sign in](https://www.figma.com/design/i1pA349chi1nTE88kWTR1e?node-id=112-3342)
from the dashboard design. The prototype uses an in-memory mock session:

- Continue with Google opens a placeholder with a Logout button.
- Logout returns to the sign-in page.
- Reloading the page clears the mock session.

This prototype does not call Google, Supabase Auth, or a backend.

## Development

```sh
bun install --frozen-lockfile
bun run dev
```

## Verification

```sh
bun run lint
bun run build
bun run test
```
