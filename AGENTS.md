## Working Principles

- Use English for all repository content (including UI copy, documentation, comments, and test descriptions), commit messages, PR titles, and PR descriptions.
- Before proposing architecture, research online how major tech companies handle similar cases and explain options, trade-offs, and your recommendation. Implement only after I finalize or approve the architecture.
- If anything is unclear, uncertain, questionable, or disputed, stop and ask me. Never make assumptions on my behalf.
- Use minimal code and change only what the task requires; avoid premature abstractions, unrequested features, unused configuration, and unrelated refactoring or formatting. Suggest simpler alternatives.
- Do not add unnecessary or redundant UI elements. Every element must serve a clear, distinct purpose.
- Never delete code you do not understand; clean up only what you introduced.
- Separate responsibilities, use clear domain-specific names and appropriate directories, and split large files or functions when needed.
- Define success criteria first and a verification check for each plan step; support correctness claims with tests, logs, or results.
- For bugs, write a failing test before fixing. Verify new features with tests as you go.

## Tech Stack

- Use Bun and TypeScript 7 for web applications.

## Git Workflow

- Branch from the latest `origin/main`; never commit directly to `main`.
- Submit all code changes through PRs and keep them mergeable into `main`.
- Squash-merge PRs after review. Delete the corresponding remote and local branches after squash merge.
- Use `<type>(<scope>): <description>` for all commit messages (including squash commits) and PR titles, excluding the temporary `WIP: ` prefix.
- Open PRs as drafts with a `WIP: ` title prefix; remove the prefix and draft status only when ready to merge. Merge only after explicit human confirmation.
- Never run destructive Git operations unless explicitly requested.

## CI/CD

- Supabase continuous deployment (CD) is configured.

## CLI tools

- Use `fly` to manage Fly.io deployments.
- Use `wrangler` (Cloudflare's CLI) to manage Workers deployments, including `docs/`.
- Use `supabase` to manage Supabase resources.
- Use `gcx` (Grafana's CLI) to query telemetry and manage Grafana resources.
