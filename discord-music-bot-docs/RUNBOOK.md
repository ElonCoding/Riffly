# Development and Operations Runbook

## Local development
1. Install a supported Node.js LTS version (matches `.nvmrc` >= 24).
2. Copy `.env.example` to `.env`; fill local secrets only (never commit `.env`).
3. Install dependencies: `npm ci`.
4. Register slash commands: `npm run register:commands`.
5. Run format check, lint, typecheck, tests, and build:
   ```bash
   npm run format:check
   npm run lint
   npm run typecheck
   npm run test
   npm run build
   ```
6. Start bot: `npm start`.

## Render deployment

### Service type
Deploy Riffly as a Render **Background Worker** (not a Web Service), because a Discord Gateway bot maintains an outbound persistent WebSocket connection rather than serving inbound HTTP traffic.

### Build and start settings
- **Environment:** Node
- **Build Command:** `npm ci && npm run build`
- **Start Command:** `npm start`

### Required environment variables in Render Dashboard
| Variable Name | Description | Required? |
|---|---|---|
| `DISCORD_TOKEN` | Discord Bot Token from Discord Developer Portal (Bot tab) | Yes |
| `DISCORD_CLIENT_ID` | Application ID (e.g. `1561808281511657523`) | Yes |
| `DISCORD_GUILD_ID` | Development guild snowflake for instant command sync | No (optional) |

> **Important:** Never commit `.env` or paste tokens in repository files. Render injects these environment variables directly into the process environment.

### Registering slash commands for Render
Slash commands can be registered anytime using:
```bash
npm run register:commands
```
- If `DISCORD_GUILD_ID` is set: registers immediately to the specific guild.
- If `DISCORD_GUILD_ID` is unset: registers globally across all guilds.

## Common problems
- **Missing environment variable:** check `.env` locally or the Environment tab on Render.
- **Bot exits immediately on Render:** fixed by persistent Gateway client in `src/index.ts`.
- **Commands do not appear:** verify application ID, invite scopes (`bot` + `applications.commands`), and rerun `npm run register:commands`.
- **Bot connects but cannot join voice:** inspect Connect/Speak permissions and voice-state intent/config (P1 music phase).
- **Lavalink connection refused:** verify node is running, host/port, firewall, and password (P1 music phase).
- **Slash command timeout:** defer the interaction before long-running provider requests, then edit the reply.

## Production safeguards
- Keep node ports private; restrict firewall ingress.
- Configure process restart and health checks.
- Rotate secrets immediately if exposed.
