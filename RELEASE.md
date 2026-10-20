# Release — Version 1

Welcome to **Version 1** of Riffly, the modular Discord music bot built for stability, low latency, and modern Discord slash command interactions.

---

## Highlights

- **Modular Player Architecture**: Decoupled player engine (`GuildPlayer`) and audio engine (`LavalinkEngine`) with full test doubles (`FakeAudioEngine`) for resilient playback control.
- **Full Slash Command Suite**:
  - `/play <query>`: Play audio from URLs or text searches.
  - `/pause` & `/resume`: Seamless playback state toggling.
  - `/skip`: Advance to the next track in queue.
  - `/stop`: Clear queue, stop playback, and disconnect.
  - `/queue`: Display currently queued tracks and pagination.
  - `/nowplaying`: Show track title, author, duration, progress, and requester.
  - `/join`: Connect bot to your active voice channel.
  - `/leave`: Disconnect bot from voice channel.
  - `/ping`: Check bot gateway latency and responsiveness.
- **Audio Engine (Lavalink v4)**: High-performance audio streaming with `lavalink-client` v2.11+, supporting URL extraction, playlist queueing, and node reconnection.
- **Query Classification & Sanitization**: Robust handling of URLs, direct links, and plain text queries with security safeguards against malformed URIs.
- **Deployment Ready**:
  - Multi-stage Dockerfile with Node 24 runtime.
  - Embedded Lavalink support via `start.sh` for single-service hosts (such as Render).
  - Health check endpoint and automated signal trapping for graceful shutdown.
- **Rigorous Test Suite**: 77 automated unit and integration tests across player lifecycles, command handlers, and gateway mocks powered by Vitest.

---

## Quick Upgrade / Getting Started

```bash
# Clone and install dependencies
git clone https://github.com/ElonCoding/Riffly.git
cd Riffly
npm install

# Configure environment
cp .env.example .env

# Build TypeScript
npm run build

# Deploy slash commands & start
npm run register:commands
npm start
```

---

## Release Specifications

| Component           | Specification  |
| :------------------ | :------------- |
| **Release Name**    | Version 1      |
| **Release Tag**     | `v1.0.0`       |
| **Discord.js**      | v14.27.0       |
| **Lavalink-Client** | v2.11.0        |
| **Node.js Target**  | `>=22.0.0 <25` |
| **License**         | Apache-2.0     |
