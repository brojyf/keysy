## Working Principles

- Use English for all repository content (including UI copy, documentation, comments, and test descriptions), commit messages, PR titles, and PR descriptions.
- Start implementation only after I finalize the architecture myself or agree on it with the agents.
- When proposing architecture, research online how major tech companies handle similar cases; explain options, trade-offs, and your recommendation.
- If anything is unclear, uncertain, questionable, or disputed, stop and ask me. Never make assumptions on my behalf.
- Use minimal code; avoid premature abstractions, unrequested features, and unused configuration. Suggest simpler alternatives.
- Change only what the task requires; avoid unrelated refactoring or formatting.
- Never delete code you do not understand; clean up only what you introduced.
- Separate responsibilities; split large files or functions when needed.
- Use clear, domain-specific names and appropriate directories.
- Define success criteria first; pair each plan step with a verification check.
- For bugs, write a failing test before fixing. Verify new features with tests as you go.
- Support correctness claims with tests, logs, or results.

## Tech Stack

- Use Bun and TypeScript 7 for web applications.

## Git Workflow

- Branch from the latest `origin/main`; never commit directly to `main`.
- Submit all code changes through PRs and keep them mergeable into `main`.
- Squash-merge PRs after review.
- Use `<type>(<scope>): <description>` for all commit messages (including squash commits) and PR titles.
- Never run destructive Git operations unless explicitly requested.

## CLI tools

- Use `fly` to manage Fly.io deployments.
- Use `wrangler` (Cloudflare's CLI) to manage Workers deployments, including `docs/`.
- Use `supabase` to manage Supabase resources.
- Use `gcx` (Grafana's CLI) to query telemetry and manage Grafana resources.
