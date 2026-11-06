# System Architecture

## 1. Context
The Discord Gateway delivers interactions to the TypeScript bot. The bot manages command handling, authorization, queues, provider selection, and user-facing status. Lavalink is a separate audio service that handles player operations and supported source loading. Discord voice carries the resulting audio to listeners.

## 2. Logical components
- Discord command layer: slash commands, buttons, interaction deadlines.
- PlayRequestService: request validation and orchestration.
- InputClassifier: query vs supported URL; provider-specific URL parsing.
- ProviderRegistry: registered adapters and declared capabilities.
- TrackResolver: searches/resolves candidates and ranks only eligible candidates.
- TrackNormalizer: maps provider-specific results into internal Track metadata.
- GuildPlayerManager: one player/queue state machine per guild.
- MusicEngine interface: abstract player operations from Lavalink client details.
- Lavalink adapter: WebSocket lifecycle, REST requests, voice-state handoff, event mapping.
- Config/Logger: validated environment config and redacted structured logs.
- Persistence (later): PostgreSQL for durable guild settings and saved playlists, not required for first playback spike.

## 3. High-level flow
1. User submits `/play <input>`.
2. Bot defers/responds appropriately to meet Discord interaction deadlines.
3. Validate guild, voice channel, permissions, request size and rate limit.
4. Classify input. URLs must use HTTP(S), match an explicit hostname allowlist, and be parsed by a known provider adapter.
5. Resolve candidate metadata through a provider that supports the requested operation.
6. Verify an eligible playback path exists; metadata-only providers are not playback providers.
7. Add a normalized Track to the guild queue.
8. MusicEngine starts playback when the player is idle.
9. Lavalink events drive state transitions and Discord UI updates.
10. On end/error/disconnect, update state once, advance/stop/recover according to policy, and report errors.

## 4. State ownership
- Discord interaction state belongs to command handlers.
- Active queue/player state belongs to GuildPlayerManager.
- Playback truth is confirmed by audio-engine events.
- Durable configuration belongs in a database when introduced.
- Temporary stream references are short-lived and should not be persisted or logged.

## 5. Deployment
Local: bot process + Lavalink process, with both secrets configured locally.
Production: long-running container/VM for the bot and audio service. Do not deploy the Gateway/voice process as a short-lived serverless function. Keep services private; expose only required ports. Configure health checks, restart policy, resource limits and logs.

## 6. Scalability
Start with one bot process and one Lavalink node. Add Redis only if multi-process coordination, distributed rate limiting, or a measured caching need emerges. Add more Lavalink nodes only after measuring load and designing session routing/recovery.
