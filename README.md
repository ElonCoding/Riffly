<p align="center">
  <img src="assets/riffly.png" alt="Riffly" width="650" />
</p>

<h1 align="center">Riffly</h1>

<p align="center">
  <strong>Next-Generation Modular Discord Platform & Enterprise Audio Streaming Engine</strong><br />
  <em>Engineered with TypeScript, Discord.js v14, Lavalink v4, and Prisma ORM.</em>
</p>

<p align="center">
  <a href="RELEASE.md"><img src="https://img.shields.io/badge/release-v2.0.0-blue.svg?style=flat-square" alt="Release: v2.0.0" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-green.svg?style=flat-square" alt="License" /></a>
  <img src="https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen.svg?style=flat-square" alt="Node Target" />
  <img src="https://img.shields.io/badge/discord.js-v14.27.0-5865F2.svg?style=flat-square" alt="Discord.js" />
  <img src="https://img.shields.io/badge/tests-415%20passed-success.svg?style=flat-square" alt="Tests" />
  <a href="CODE_OF_CONDUCT.md"><img src="https://img.shields.io/badge/Contributor%20Covenant-v2.1-4baaaa.svg?style=flat-square" alt="Contributor Covenant" /></a>
</p>

---

## ⚡ Overview

**Riffly** is an enterprise-grade modular Discord platform featuring a low-latency music streaming engine, high-capacity task scheduling, extensible DAG-ordered modules, PostgreSQL database persistence, an embedded management dashboard, and comprehensive community infrastructure.

Built strictly with zero unmaintained dependencies, Riffly guarantees 100% type safety, deterministic concurrency control, and zero memory leaks.

---

## 🚀 Key Architectural Pillars

### 1. High-Performance Audio Streaming
- **Lavalink v4 Protocol**: Direct WebSocket/REST v4 communication with connection pooling and heartbeat recovery.
- **5-State Audio FSM**: Deterministic state machine (`disconnected` → `idle` → `buffering` → `playing` → `paused`) eliminating race conditions.
- **Circuit Breaker & Deadlock-Free Concurrency**: Automatic error tripping on consecutive playback failures and FIFO queue mutex protection (`AsyncMutex`).
- **DSP Audio Equalization Filters**: Real-time filters including `bassboost`, `nightcore`, `vaporwave`, `8d`, `tremolo`, and `karaoke`.
- **Smart Autoplay**: Automatic recommendation replenishment when queues conclude.
- **Interactive Component Controls**: Real-time Discord button controls for instant play, pause, resume, skip, stop, loop, and shuffle.

### 2. Extensible Modular Framework
- **Topological DAG Registry**: Declarative module definitions with dependency injection and lifecycle lifecycle hooks (`onInit`, `onDestroy`).
- **Priority Event Dispatcher**: Guild-scoped priority event buses for intercepting and handling Discord Gateway payloads.
- **Persistent Task Scheduler**: Distributed job runner with exponential backoff, retry limits, and database queue persistence.

### 3. Integrated Platform Modules
- 🛡️ **Moderation & Audit Logging**: Case tracking, timeout, kick, ban, purge, and event audit trails.
- 🎟️ **Tickets & Role Verification**: Ephemeral ticket threads, stream transcripts, and button-activated role assignment.
- 🔊 **Dynamic Voice Rooms**: Join-To-Create temporary voice channels with owner controls and auto-cleanup.
- 📈 **Experience & Leveling**: Non-linear mathematical XP curves, cooldown protection, and visual rank cards.
- 🤖 **PatternGuard AutoMod**: Heuristic anti-invite, anti-link, mention spam protection, and bucket rate-limiters.
- ⭐ **Starboard & Timed Giveaways**: Reaction-based starboard pinning and persistent giveaway lotteries.
- 💰 **Virtual Economy**: Account management, daily rewards, work cycles, peer transactions, and banking.
- 💡 **Contextual AI Assistant**: `/ask` knowledge agent answering server and bot queries.
- 💾 **Server Preservation**: Structural backups of guild channels, permissions, and roles (`/backup`).

### 4. Live Web Dashboard & REST API
- Built-in lightweight HTTP service with CORS, bearer authentication, and sub-millisecond response times.
- Real-time player playback controls, system health metrics, leaderboards, and guild configuration APIs.
- **OpenAPI 3.0 & Swagger UI**: Interactive API documentation available out of the box at `/api/docs`.

---

## 📖 Command Matrix

### Audio & Playback

| Command | Arguments | Description |
| :--- | :--- | :--- |
| `/play` | `<query>` | Search YouTube/SoundCloud/Direct URLs and enqueue audio tracks or playlists. |
| `/pause` | _None_ | Pause audio playback. |
| `/resume` | _None_ | Resume paused playback. |
| `/skip` | _None_ | Skip the active track and advance the queue. |
| `/stop` | _None_ | Stop playback, flush queue, and leave voice channel. |
| `/nowplaying`| _None_ | Render active track details with visual ASCII progress bar. |
| `/queue` | `[page]` | View upcoming tracks with duration calculations. |
| `/volume` | `<level>` | Set playback volume between 0% and 150%. |
| `/loop` | `[mode]` | Cycle repeat mode (`off`, `track`, `queue`). |
| `/shuffle` | _None_ | Randomize queue tracks with Fisher-Yates shuffle. |
| `/seek` | `<position>`| Jump to target timestamp (`mm:ss` or seconds). |
| `/remove` | `<position>`| Remove specific track from the queue. |
| `/clear` | _None_ | Purge upcoming queued tracks. |
| `/filter` | `<preset>` | Apply DSP filters (`bassboost`, `nightcore`, `vaporwave`, `8d`, `tremolo`, `karaoke`, `clear`). |
| `/autoplay`| `[enabled]`| Toggle smart queue continuation. |
| `/join` | _None_ | Summon Riffly to user voice channel. |
| `/leave` | _None_ | Disconnect Riffly from voice channel. |

### Moderation & Security

| Command | Arguments | Description |
| :--- | :--- | :--- |
| `/ban` | `<user> [reason]` | Ban member and record permanent moderation case. |
| `/kick` | `<user> [reason]` | Kick member from the guild. |
| `/timeout` | `<user> <duration> [reason]` | Mute member for specified duration. |
| `/warn` | `<user> <reason>` | Issue formal server warning. |
| `/cases` | `<user>` | Inspect moderation infractions and history. |
| `/purge` | `<amount>` | Bulk delete up to 100 recent messages. |

### Server Tools & Engagement

| Command | Arguments | Description |
| :--- | :--- | :--- |
| `/ticket` | `<create\|close\|claim\|add\|remove>` | Manage interactive private support tickets. |
| `/verification panel` | `<channel> <role>` | Deploy click-to-verify role panel. |
| `/rank` | `[user]` | View level progress, rank, and XP bar. |
| `/leaderboard` | `[page]` | Display top server members ranked by activity. |
| `/voice` | `<name\|limit\|lock\|unlock>` | Manage temporary Join-To-Create voice rooms. |
| `/giveaway` | `<start\|end\|reroll>` | Host button-entered prize giveaways. |
| `/balance` | `[user]` | Inspect wallet and bank holdings. |
| `/daily` | _None_ | Claim daily currency reward. |
| `/work` | _None_ | Complete periodic shift for currency. |
| `/pay` | `<user> <amount>` | Transfer currency to another server member. |
| `/deposit` | `<amount>` | Move funds from wallet to secure bank. |
| `/withdraw`| `<amount>` | Withdraw funds from bank to active wallet. |
| `/ask` | `<question>` | Consult the Riffly AI Assistant. |
| `/backup` | `<create\|list>` | Capture or list server layout and role snapshots. |
| `/serverinfo` | _None_ | Display guild creation date, members, and channels. |
| `/userinfo` | `[user]` | Display account metrics, badges, and joined timestamp. |
| `/avatar` | `[user]` | Retrieve high-resolution member avatar. |
| `/poll` | `<question> <options>` | Create interactive multi-choice community poll. |
| `/remindme` | `<time> <reminder>` | Schedule persistent direct message reminder. |

---

## 🌐 Web Dashboard & API

Riffly bundles an integrated HTTP management service running natively without extra dependencies:

- **Web Dashboard**: `http://localhost:3000/dashboard`
- **Swagger UI Documentation**: `http://localhost:3000/api/docs`
- **OpenAPI 3.0 Specification**: `http://localhost:3000/api/openapi.json`
- **Endpoints**:
  - `GET /health` — Service uptime and node status
  - `GET /api/status` — Gateway ping, guild count, active audio players
  - `GET /api/guilds` — Bot guild listing
  - `GET /api/guilds/:id/player` — Live player queue and state
  - `POST /api/guilds/:id/player` — Remote control (play, pause, resume, skip, stop, volume)
  - `GET /api/guilds/:id/moderation` — Guild moderation audit cases
  - `GET /api/guilds/:id/leaderboard` — Guild experience rankings

---

## 🛠️ Installation & Setup

### 1. Prerequisites
- **Node.js**: `v22.0.0` or higher
- **PostgreSQL**: Local instance or cloud database (Supabase / Neon / Railway)
- **Lavalink v4**: Audio streaming node (included in Docker setup)
- **Discord Bot Token & Client ID**: Configured via Discord Developer Portal

### 2. Environment Configuration
Create a `.env` file from `.env.example`:

```ini
# Discord Gateway
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_GUILD_ID= # Optional: Guild ID for instant development slash command deployment

# Database (PostgreSQL / Supabase)
DATABASE_URL="postgresql://postgres:password@localhost:5432/riffly?schema=public"

# Lavalink v4
LAVALINK_HOST=localhost
LAVALINK_PORT=2333
LAVALINK_PASSWORD=youshallnotpass
LAVALINK_SECURE=false

# Web Dashboard
DASHBOARD_PORT=3000
DASHBOARD_API_KEY=riffly_secret_api_key_123
```

### 3. Database Migration & Command Deployment

```bash
# Push Prisma schema to database
npm run prisma:push

# Compile TypeScript source
npm run build

# Deploy slash commands to Discord
npm run register:commands

# Start Riffly
npm start
```

---

## 🐳 Container & Cloud Deployment

### Docker Deployment
```bash
docker compose up -d
```

### Render Single-Service Deployment
Riffly is pre-configured with a multi-stage `Dockerfile` and `render.yaml` running the Node.js application, Lavalink v4 audio server, and HTTP dashboard concurrently in a single production container with health checks.

---

## 🧪 Testing & Code Quality

Riffly maintains a comprehensive automated testing suite:

```bash
# Run 415 automated unit & integration tests
npm test

# Run TypeScript type validation
npm run typecheck

# Run ESLint validation
npm run lint

# Format code with Prettier
npm run format
```

---

## 📄 License

This project is licensed under the **Apache-2.0 License** — see the [LICENSE](LICENSE) file for details.
