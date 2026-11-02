# Riffly Audio Engine: Native Voice Architecture & Non-Lavalink Alternatives

## 1. Executive Summary

Riffly currently utilizes **Lavalink v4** (a standalone Java audio streaming server communicating via WebSockets and UDP). While Lavalink offloads audio encoding from Node.js, modern YouTube anti-bot protections (cipher shuffling, Proof of Origin tokens, datacenter IP blacklisting) frequently disrupt cloud/self-hosted Lavalink nodes.

This guide details **alternative audio architectures** to eliminate Lavalink entirely or bypass datacenter streaming restrictions.

---

## 2. Architecture Comparison

| Feature | Current (Lavalink v4) | Alternative A (Native `@discordjs/voice`) | Alternative B (NodeLink / PyLink) | Alternative C (Remote Hosted Nodes) |
|---|---|---|---|---|
| **Runtime** | Java 18+ & Docker | **Pure Node.js / TypeScript** | Node.js or Python | Remote Java server |
| **Containers Needed** | Yes (`riffly-lavalink`) | **None (Zero Docker)** | Yes (or native node script) | None |
| **Voice Connection** | Indirect (Gateway Op 4 via Lavalink) | **Direct (`@discordjs/voice` UDP socket)** | Indirect (Lavalink protocol) | Indirect (Lavalink protocol) |
| **YouTube Handling** | Java `youtube-plugin` | **`play-dl` / `@distube/ytdl-core`** | Node.js InnerTube scrapers | Managed by host provider |
| **SoundCloud / Spotify** | Lavaplayer plugins | **Native scraping & tokens** | Integrated | Integrated |
| **Resource Usage** | ~1 GB RAM (JVM overhead) | **~50–100 MB RAM** | ~80 MB RAM | 0 MB local RAM |
| **Reliability** | Susceptible to IP subnet blocks | **High (Direct in-process stream)** | High (Built-in proxy rotation) | High (Clean residential IPs) |

---

## 3. Alternative A: Native `@discordjs/voice` (Recommended Direct Fix)

### Overview
In this architecture, Riffly connects **directly** to Discord voice servers using Discord.js's official voice package (`@discordjs/voice`). Audio is fetched in Node.js via streaming libraries (`play-dl` or `@distube/ytdl-core`), transcoded into Opus packets via `prism-media` and `ffmpeg`, and sent over Discord's voice UDP connection.

### Key Benefits
1. **Zero External Dependencies**: No Java, no Docker container, no external ports (`2333`).
2. **Direct Connection**: No handshake race conditions or dropped packets between Node.js and Lavalink.
3. **Multi-Source Support**: `play-dl` supports YouTube, YouTube Music, Spotify tracks/playlists, SoundCloud, and Deezer natively.

### Architecture Flowchart
```
User Slash Command (/play)
   │
   ▼
Interaction Handler (src/commands/play.ts)
   │
   ▼
Track Search (play-dl / @distube/ytdl-core)
   │
   ▼
Native Audio Player (createAudioPlayer from @discordjs/voice)
   │
   ▼
Voice Connection (joinVoiceChannel from @discordjs/voice)
   │
   ▼
Opus Stream Transmission Directly to Discord Voice Server
```

### Required Dependencies
```bash
npm install @discordjs/voice @discordjs/opus prism-media play-dl ffmpeg-static
```

### Implementation Prototype (`NativeAudioEngine`)
```typescript
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
} from '@discordjs/voice';
import play from 'play-dl';

export class NativeAudioEngine {
  private players = new Map<string, any>();

  async connectAndPlay(guild: any, channelId: string, query: string) {
    // 1. Join voice channel directly
    const connection = joinVoiceChannel({
      channelId,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: false,
    });

    await entersState(connection, VoiceConnectionStatus.Ready, 10_000);

    // 2. Resolve audio stream
    const searchResults = await play.search(query, { limit: 1 });
    if (!searchResults.length) throw new Error('No tracks found.');

    const track = searchResults[0];
    const stream = await play.stream(track.url);

    // 3. Create audio resource and play
    const resource = createAudioResource(stream.stream, {
      inputType: stream.type,
    });

    const player = createAudioPlayer();
    player.play(resource);
    connection.subscribe(player);

    return { title: track.title, duration: track.durationRaw };
  }
}
```

---

## 4. Alternative B: NodeLink (Drop-in Lavalink Replacement)

### Overview
[NodeLink](https://github.com/PerformanC/NodeLink) is a lightweight Lavalink v4-compatible server written in **Node.js** instead of Java. It implements the exact same REST and WebSocket API as Lavalink, meaning **zero code changes are required in Riffly's TypeScript codebase**.

### Key Benefits
- **Drop-in Compatible**: Keep existing `src/audio/lavalink-engine.ts`, `GuildPlayerManager`, and `lavalink-client` code untouched.
- **Superior YouTube Scraping**: Built on Node.js YouTube InnerTube engines with automatic cookie handling, IPv6 rotation, and proxy support.
- **Lightweight**: Uses ~60MB RAM compared to Java's ~1GB.

### Running NodeLink via Docker
```bash
docker run -d \
  --name riffly-nodelink \
  -p 127.0.0.1:2333:2333 \
  -e NODELINK_PASSWORD=youshallnotpass \
  ghcr.io/performanc/nodelink:latest
```

---

## 5. Alternative C: Free Remote Lavalink Nodes

If you prefer not to manage audio servers or stream scraping locally, you can connect Riffly to verified public Lavalink nodes hosted on residential/unblocked networks.

### Configuration (`.env`)
Replace local Lavalink variables:
```env
LAVALINK_HOST=lava-v4.ajieblogs.eu.org
LAVALINK_PORT=443
LAVALINK_PASSWORD=https://dsc.gg/ajidevserver
LAVALINK_SECURE=true
```

---

## 6. Recommended Action Plan

1. **Immediate Test**: Run `/play` now. YouTube OAuth refresh token (`1//0gvFBmpg...`) has been saved and authenticated in `lavalink/application.yml`.
2. **If Upstream YouTube IP Block Persists**:
   - Option A: Switch to **Alternative B (NodeLink)** by replacing the Docker container (0 code changes, immediate recovery).
   - Option B: Adopt **Alternative A (Native `@discordjs/voice`)** to eliminate external audio servers entirely.

