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
  <img src="https://img.shields.io/badge/tests-449%20passed-success.svg?style=flat-square" alt="Tests" />
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
- **Topological DAG Registry**: Declarative module definitions with dependency injection and lifecycle hooks (`onInit`, `onDestroy`).
- **Priority Event Dispatcher**: Guild-scoped priority event buses for intercepting and handling Discord Gateway payloads.
- **Persistent Task Scheduler**: Distributed job runner with exponential backoff, retry limits, and database queue persistence.
- **Unified Prefix & No-Prefix Resolver**: Custom guild prefixes (`!prefix set`), mention triggers, and VIP zero-prefix execution.

### 3. Integrated Platform Modules
- 🛡️ **Moderation & 4-Tier Hierarchy**: Server Owner, Extra Owner, Admin, and Mod tiers with granular 12-permission bitmasks, sanctions, cases, purge, lock, and jail isolation.
- 🔒 **Security Defenses**: Heuristic Anti-Nuke (rogue moderator ban), Anti-Raid (mass-join lockdown), and PatternGuard AutoMod.
- 🎟️ **Tickets & Verification**: Self-managed ticket panels with transcripts, and single-click role verification panels.
- 🔊 **VoiceMaster Dynamic Voice**: Join-to-Create hubs (Normal, Duo, Trio, Quad presets) with real-time room owner permissions.
- 📈 **Experience & Leveling**: Non-linear math curves, voice & message tracking, visual rank cards, and 15s auto-updating live leaderboards.
- 📋 **Automated Dedicated Logging**: One-click 6-channel category generator (`messages`, `voice`, `members`, `mod`, `server`, `bot`).
- ⭐ **Starboard & Timed Giveaways**: Reaction milestones, clownboard hall-of-shame, and button-entered prize lotteries.
- 🤝 **Community Suite**: AutoRoles, Reaction Roles, Vanity Roles, Counting streak channel, AutoResponders, Bump Reminders, and Booster Roles.
- 💰 **Virtual Economy**: Wallets, banks, daily rewards, work shifts, begging, casino gambling, and wealth rankings.
- 🎮 **Fun & Entertainment Minigames**: 20+ roleplay interactions, image filters, Tic-Tac-Toe, Trivia, Urban Dictionary, and Fortnite stats.
- 💾 **Server Preservation & Templates**: Layout and role snapshot creation and restoration (`/template`, `/backup`).
- 💡 **Contextual AI Assistant**: `/ask` knowledge agent answering server and bot queries.

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

### Staff Hierarchy & Security

| Command | Arguments | Description |
| :--- | :--- | :--- |
| `/extraowner` | `add\|remove\|list` | Assign Co-Owners with full bot authority. |
| `/admin` | `add\|edit\|remove\|list` | Configure Tier 3 Administrators with interactive 12-perm bitmask. |
| `/mod` | `add\|edit\|remove\|list` | Configure Tier 4 Moderators with custom permission bits. |
| `/antinuke` | `enable\|disable\|config\|whitelist` | Sliding-window monitor banning rogue moderators performing mass actions. |
| `/antiraid` | `enable\|disable\|config\|lockdown` | Join rate limiter and emergency server lockdown. |
| `/automod` | `toggle\|banned-words\|whitelist\|view` | Anti-invite, anti-link, anti-caps, mention spam, and rate limiters. |

### Moderation & Cases

| Command | Arguments | Description |
| :--- | :--- | :--- |
| `/ban` | `<target> [reason] [delete_days]` | Ban member and record case. |
| `/unban` | `<user_id> [reason]` | Revoke ban by ID. |
| `/kick` | `<target> [reason]` | Kick member with DM notice. |
| `/timeout` | `<target> <duration> [reason]` | Apply timeout sanction. |
| `/mute` / `/unmute` | `<target> [duration] [reason]` | Mute or restore chatting privileges. |
| `/softban` | `<target> [reason]` | Ban and unban immediately to purge messages. |
| `/warn` | `<target> <reason>` | Issue recorded infraction warning. |
| `/cases` | `[target]` | View member infraction history. |
| `/purge` | `<amount>` | Bulk delete up to 100 messages. |
| `/slowmode` | `<seconds>` | Set text channel cooldown rate. |
| `/lock` / `/unlock` | `[channel] [role]` | Lock or unlock text/voice channel. |
| `/hide` / `/unhide` | `[channel] [role]` | Toggle channel visibility. |
| `/jail` | `<target> [reason]` | Strip roles and isolate member in jail channel. |
| `/unjail` | `<target>` | Restore original member roles and release from jail. |
| `/vcmute` / `/vcunmute` | `<target>` | Voice mute or unmute connected member. |
| `/vcdeafen` / `/vcundeafen`| `<target>` | Voice deafen or undeafen connected member. |

### Dynamic VoiceMaster

| Command | Arguments | Description |
| :--- | :--- | :--- |
| `/voicemaster setup` | `[type]` | Deploy Join-to-Create category & hub (Normal/Duo/Trio/Quad). |
| `/voicemaster info` | _None_ | Inspect active VoiceMaster room configuration. |
| `/vc name` | `<name>` | Rename your temporary voice room. |
| `/vc limit` | `<number>` | Adjust user limit (0-99). |
| `/vc lock` / `/vc unlock` | _None_ | Prevent or permit connections from @everyone. |
| `/vc hide` / `/vc unhide` | _None_ | Toggle room visibility in server channel list. |
| `/vc permit` / `/vc reject` | `<user>` | Whitelist or kick and ban member from your room. |
| `/vc transfer` | `<user>` | Transfer temporary room ownership to another participant. |

### Community & Engagement

| Command | Arguments | Description |
| :--- | :--- | :--- |
| `/ticket setup\|panel` | `[options]` | Configure categories, roles, and dispatch support ticket panel. |
| `/ticket claim\|unclaim\|close`| _None_ | Staff ticket operations, claiming, and closure. |
| `/verify setup\|panel` | `<role> <channel>` | Deploy interactive button verification panel. |
| `/rank` | `[user]` | View voice XP, message counts, level, and rank. |
| `/leaderboard view` | `[timeframe] [metric]`| Browse daily, weekly, or monthly XP and voice leaderboards. |
| `/leaderboard setup` | `<channel>` | Deploy live-updating leaderboard embed (15s interval). |
| `/autorole add\|remove\|list` | `<role> [target]` | Automatic role assignment on member join (humans/bots). |
| `/reactionrole create` | `<channel> <msg_id> <emoji> <role>`| Interactive emoji reaction role binding. |
| `/vanityrole add` | `<keyword> <role>` | Award custom role for server link/vanity in user status. |
| `/clownboard setup` | `<channel> [threshold]`| Configure reaction hall-of-shame highlight feed. |
| `/counter setup` | `<channel>` | Dedicated counting channel streak game with bot validation. |
| `/autoresponder add` | `<trigger> <reply> [type]`| Set keyword auto-replies (exact, contains, regex). |
| `/timer create` | `<channel> <duration> <name>`| Live channel countdown timer. |
| `/bumper setup` | `<channel>` | 2-hour server bump reminders. |
| `/social add` | `<platform> <account> <channel>`| Social alerts for YouTube, Twitch, and Reddit. |
| `/boosterrole create` | `<name> <color>` | Exclusive customizable role for server boosters. |

### Utilities, Economy & Fun

| Command | Arguments | Description |
| :--- | :--- | :--- |
| `/afk` | `[reason]` | Set status and auto-reply to mentions. |
| `/suggest` / `/report` | `<content>` | Submit community suggestions or staff reports. |
| `/announce` / `/embed` | `[options]` | Dispatch rich announcements and embedded layouts. |
| `/serverinfo` / `/userinfo` | `[target]` | Deep inspection of server or member metrics. |
| `/snipe` / `/editsnipe` | _None_ | Retrieve recently deleted or edited messages in channel. |
| `/crypto` / `/weather` | `<query>` | Live cryptocurrency prices and weather forecast. |
| `/translate` / `/wiki` | `<query>` | Translation engine and Wikipedia article summaries. |
| `/balance` / `/pay` | `[user] [amount]` | Economy wallet, bank holdings, and coin transfers. |
| `/work` / `/daily` / `/beg` | _None_ | Earn virtual currency shifts, daily rewards, and begging. |
| `/gamble` | `<amount>` | Roll dice against the casino for double stakes. |
| `/rp` | `<action> [user]` | Anime roleplay interactions (hug, kiss, slap, pat, etc.). |
| `/image` | `<effect> [user]` | Visual canvas effects (grayscale, invert, sepia, blur). |
| `/tictactoe` / `/trivia` | `[opponent]` | Interactive button minigames. |
| `/prefix set` | `<prefix>` | Configure custom guild prefix for message commands. |
| `/prefix noprefix grant` | `<user> [duration]`| VIP zero-prefix command execution privilege. |
| `/template save\|list` | `<name>` | Capture server channels, categories, and role layout. |

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
