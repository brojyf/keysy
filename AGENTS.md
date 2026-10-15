## Git Workflow

- Branch from the latest `origin/main`; never commit directly to `main`.
- Submit all code changes through PRs and keep them mergeable into `main`.
- Squash-merge PRs after review.
- Use `<type>(<scope>): <description>` for all commit messages (including squash commits) and PR titles.

## CLI tools

- Use `fly` to manage Fly.io deployments.
- Use `wrangler` (Cloudflare's CLI) to manage Workers deployments, including `docs/`.
- Use `supabase` to manage Supabase resources.
- Use `gcx` (Grafana's CLI) to query telemetry and manage Grafana resources.
