## Working Principles

- Use English for all repository content (including UI copy, documentation, comments, and test descriptions), commit messages, PR titles, and PR descriptions. Write replies in ASD-STE100 (Simplified Technical English) style.
- Before proposing architecture, research online how major tech companies handle similar cases and explain options, trade-offs, and your recommendation. Implement only after I finalize or approve the architecture.
- If anything is unclear, uncertain, questionable, or disputed, stop and ask me. Never make assumptions on my behalf.
- Use minimal code and change only what the task requires; avoid premature abstractions, unrequested features, unused configuration, and unrelated refactoring or formatting. Abstract only when code is reused. Clean up only what you introduced. Suggest simpler alternatives.
- Do not add unnecessary or redundant UI elements. Every element must serve a clear, distinct purpose.
- When designing, reference the design tokens in `design/tokens`.
- Never delete code you do not understand.
- Separate responsibilities, use clear domain-specific names and appropriate directories, and split large files or functions when needed.
- Define success criteria first and a verification check for each plan step; support correctness claims with tests, logs, or results.
- For bugs, write a failing test before fixing. Verify new features with tests as you go.

## Tech Stack

- Use Bun and TypeScript 7 for web applications.
- Use Go with Gin for backend services, GORM for database access, and Air for automatic rebuilds and restarts during development.

## Git Workflow

0. Never run destructive Git operations unless explicitly requested.
1. Branch from the latest `origin/main` and open a draft PR with a `WIP: ` title prefix. Never commit directly to `main`.
2. Commit on your own when you complete a feature. Use `<type>(<scope>): <description>` for all commit messages (including squash commits) and PR titles, excluding the temporary `WIP: ` prefix.
3. After review, remove the `WIP: ` prefix and draft status. Squash-merge only after explicit human confirmation, and append the PR number to the squash merge commit message, for example `(#123)`. After squash merge, delete the remote branch and the local branch or worktree.

## CI/CD

- Supabase continuous deployment (CD) is configured.

## CLI tools

- Use `fly` to manage Fly.io deployments.
- Use `wrangler` (Cloudflare's CLI) to manage Workers deployments, including `docs/` and `wiki/`.
- Use `supabase` to manage Supabase resources.
- Use `gcx` (Grafana's CLI) to query telemetry and manage Grafana resources.
