# Documentation project instructions

## About this project

- Use Sourcey with Bun and TypeScript 7; configuration lives in `sourcey.config.ts`.
- Pages are MDX files with YAML frontmatter and Sourcey-compatible components.
- Keep the six navigation tabs and existing public page URLs stable.
- Use native Sourcey controls; keep brand overrides in `style.css`.
- Put only intentionally public, fixed-path assets in `public/`.
- Consult [Sourcey's documentation](https://sourcey.com/docs) for configuration and components.

## Writing and verification

- Write in English, use active voice and second person, and keep sentences concise.
- Use sentence case for headings, bold for UI elements, and code formatting for paths and commands.
- Do not invent product requirements or undocumented API endpoints.
- Run `bun run check`, `bun run test`, and `bun audit --audit-level=high` from `wiki/`.
- Do not run browser verification or deploy unless explicitly requested.
