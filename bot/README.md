# bot

This is an [eve](https://eve.dev) agent bootstrapped with [`eve init`](https://eve.dev/docs/reference/cli#eve-init).

## Getting started

First, run the development server:

```bash
eve dev
```

The development TUI opens an interactive session where you can send messages to your agent.

Start by editing `agent/instructions.md` to define the agent's identity, purpose, tone, and response guidelines. Configure its model and runtime behavior in `agent/agent.ts`.

Add capabilities under `agent/`, including tools, connections, channels, skills, subagents, and schedules. eve reloads your changes as you work.

## Learn more

To learn more about eve, explore these resources:

- [eve documentation](https://eve.dev/docs) — learn about eve's features and authoring APIs.
- [eve on GitHub](https://github.com/vercel/eve) — view the source and contribute.

## Deploy on Vercel

Set `DEEPSEEK_API_KEY` in the Vercel Production environment. The agent uses this key to call DeepSeek directly through the AI SDK.

Set `DISCORD_GUILD_ID` to the Discord server ID in the same environment. The bot accepts slash commands and interactive responses only from that server.

Set `FLY_API_TOKEN` to the full output of `fly tokens create readonly -o personal`, including the `FlyV1 ` prefix. The `query_fly_metrics` and `query_fly_logs` tools use it to read Fly.io metrics and logs.

Set `GRAFANA_TOKEN` to a token of the `keysy-bot` Grafana Cloud access policy, which has only the `logs:read` and `metrics:read` scopes on the `earnestsalad2096` stack. The `query_grafana_logs` and `query_grafana_metrics` tools use it to read Loki logs and Prometheus metrics.

Set `CLOUDFLARE_TOKEN` to a Cloudflare API token that has only the `Account Analytics: Read` and `Zone Analytics: Read` permissions, scoped to the Keysy account and the `keysy.net` zone. The `query_cloudflare_analytics` tool uses it to read HTTP request and Worker analytics through the GraphQL Analytics API.

Deploy your agent to [Vercel](https://vercel.com) from the project root:

```bash
eve deploy
```

`eve deploy` links a Vercel project if needed and deploys the agent to production. See the [eve deployment documentation](https://eve.dev/docs/guides/deployment/vercel) for authentication, environment variables, and deployment options.
