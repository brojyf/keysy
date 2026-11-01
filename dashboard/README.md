# Keysy dashboard

React and TypeScript application built with Vite and Bun.

## Sign-in prototype

The prototype uses [1.1 Sign in](https://www.figma.com/design/i1pA349chi1nTE88kWTR1e?node-id=112-3342)
as its design reference. It uses an in-memory mock session:

- Continue with Google opens a placeholder with a Logout button.
- Logout returns to the sign-in page.
- Reloading the page clears the mock session.

This prototype does not call Google, Supabase Auth, or a backend.
Status, Privacy, and Terms remain non-interactive placeholders until their public URLs are available.
The Keysy symbol, Google symbol, and dot tile in `src/assets/sign-in/` were exported from this Figma screen.

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
