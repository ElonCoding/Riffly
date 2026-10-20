<p align="center">
  <img src="assets/riffly.png" alt="Riffly" width="650" />
</p>

<h1 align="center">Riffly</h1>

<p align="center">
  <strong>High-performance, modular Discord music bot built with TypeScript, Discord.js v14, and Lavalink v4.</strong>
</p>

<p align="center">
  <a href="RELEASE.md"><img src="https://img.shields.io/badge/release-Version%201-blue.svg?style=flat-square" alt="Release: Version 1" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-green.svg?style=flat-square" alt="License" /></a>
  <img src="https://img.shields.io/badge/node-%3E%3D22.0.0-brightgreen.svg?style=flat-square" alt="Node Target" />
  <img src="https://img.shields.io/badge/discord.js-v14.27.0-5865F2.svg?style=flat-square" alt="Discord.js" />
  <img src="https://img.shields.io/badge/tests-77%20passed-success.svg?style=flat-square" alt="Tests" />
  <a href="CODE_OF_CONDUCT.md"><img src="https://img.shields.io/badge/Contributor%20Covenant-v2.1-4baaaa.svg?style=flat-square" alt="Contributor Covenant" /></a>
</p>

---

## Overview

**Riffly** is a modular Discord music bot engineered for low latency, reliable streaming, and intuitive slash command interactions. Powered by Discord.js v14 and Lavalink v4, Riffly handles voice channel connectivity, audio queue lifecycle, and track resolution through a cleanly decoupled architecture.

---

## Key Features

- **Lavalink v4 Audio Streaming**: High-throughput audio node integration with automatic reconnection handling.
- **Native Slash Commands**: Full suite of Discord interaction commands with typed input parsers.
- **Robust Queue Lifecycle**: Per-guild in-memory player management supporting track queues, repeat states, and graceful disconnects.
- **Smart Query Classifier**: Distinguishes direct stream URLs from search queries with URI security guards.
- **Container & Cloud Ready**: Production Dockerfile and Render single-service configuration with embedded Lavalink and health check endpoints.
- **Comprehensive Test Suite**: 77 automated Vitest unit and integration tests covering state machines, interaction handlers, and configuration.

---

## Slash Commands

| Command       | Arguments              | Description                                                    |
| :------------ | :--------------------- | :------------------------------------------------------------- |
| `/play`       | `<query>` _(required)_ | Search and play a track or load a playlist URL into the queue. |
| `/pause`      | _None_                 | Pause the currently playing audio stream.                      |
| `/resume`     | _None_                 | Resume audio playback if paused.                               |
| `/skip`       | _None_                 | Skip the currently active track and play the next in queue.    |
| `/stop`       | _None_                 | Stop playback, clear the guild queue, and leave voice channel. |
| `/queue`      | _None_                 | Display the list of upcoming tracks in the queue.              |
| `/nowplaying` | _None_                 | Show track details, duration, elapsed time, and requester.     |
| `/join`       | _None_                 | Summon Riffly to your active voice channel.                    |
| `/leave`      | _None_                 | Disconnect Riffly from the voice channel.                      |
| `/ping`       | _None_                 | Check bot Gateway websocket latency and status.                |

---

## Prerequisites

- **Node.js**: `v22.0.0` or higher (`<25`)
- **Lavalink**: Lavalink v4 server instance (or use the built-in Docker / Render runner)
- **Discord Bot Token**: Created via the [Discord Developer Portal](https://discord.com/developers/applications) with `bot` and `applications.commands` scopes.

---

## Quickstart

### 1. Clone & Install

```bash
git clone https://github.com/ElonCoding/Riffly.git
cd Riffly
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and supply your Discord credentials and Lavalink node configuration:

```bash
cp .env.example .env
```

```ini
# Discord Credentials
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_GUILD_ID= # Optional: Provide guild ID for instant dev slash command registration

# Lavalink Node Configuration
LAVALINK_HOST=localhost
LAVALINK_PORT=2333
LAVALINK_PASSWORD=youshallnotpass
LAVALINK_SECURE=false
```

### 3. Build & Deploy Commands

```bash
# Compile TypeScript to dist/
npm run build

# Register slash commands with Discord API
npm run register:commands
```

### 4. Start the Bot

```bash
npm start
```

---

## Deployment with Docker

Build and run using the included container configuration:

```bash
# Build image
docker build -t riffly .

# Run with environment file
docker run --env-file .env riffly
```

For docker-compose setups:

```bash
docker compose up -d
```

---

## Quality & Testing

Riffly enforces strict TypeScript typing, ESLint compliance, and automated test coverage:

```bash
# Run unit and integration tests
npm test

# Run TypeScript typecheck
npm run typecheck

# Run linter
npm run lint

# Format code with Prettier
npm run format
```

---

## Releases

All releases and changelogs are documented in [RELEASE.md](RELEASE.md).

- Current version: **[Version 1](RELEASE.md)**

---

## Code of Conduct

We are committed to providing a welcoming and inclusive community. Please read our **[Code of Conduct](CODE_OF_CONDUCT.md)** before contributing.

---

## License

This project is licensed under the **Apache-2.0 License** — see the [LICENSE](LICENSE) file for details.
