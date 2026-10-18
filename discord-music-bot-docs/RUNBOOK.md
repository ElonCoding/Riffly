# Development and Operations Runbook

## Local development
1. Install a supported Node.js LTS version.
2. Copy `.env.example` to `.env`; fill local secrets only.
3. Install with `npm ci` when a lockfile exists; use `npm install` for initial dependency resolution.
4. Register slash commands to a private test guild.
5. Run typecheck, tests, build, then start the bot.
6. Start Lavalink only after its compatible Java/runtime and config are verified.

## Common problems
- Missing environment variable: check `.env` filename, location, and key names.
- Commands do not appear: verify application ID, test guild ID, bot invite scopes, and rerun command deployment.
- Bot connects but cannot join voice: inspect Connect/Speak permissions and voice-state intent/config.
- Lavalink connection refused: verify node is running, host/port, firewall, and password.
- Track resolves but does not play: confirm the source provides a playback-capable reference and inspect Lavalink event/error logs.
- Slash command timeout: defer the interaction before long-running provider requests, then edit the reply.

## Production safeguards
- Use a long-running process/container.
- Keep node ports private; restrict firewall ingress.
- Configure process restart, health checks, log rotation, resource caps, and backups for durable data.
- Rotate secrets if exposed.
- Do not publish until release gates pass.
