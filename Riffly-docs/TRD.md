# Technical Requirements Document (TRD)

## 1. Baseline stack
- Language: TypeScript, strict mode.
- Runtime: Node.js LTS supported by the chosen versions.
- Discord API library: discord.js.
- Audio backend: Lavalink, using a maintained TypeScript client compatible with the deployed Lavalink version.
- Tests: Vitest or another chosen TypeScript test runner.
- Lint/format: ESLint and Prettier.
- Local orchestration: Docker Compose when bot + Lavalink are both integrated.
- Persistence: none required for first audio spike; PostgreSQL + Prisma only when durable settings/playlists are implemented.
- CI: install, typecheck, lint, tests, build.

## 2. Version policy
Do not blindly copy package versions from an AI answer. Verify current supported Node.js LTS, discord.js, Lavalink, Java runtime, Lavalink client, and plugin compatibility from official documentation before pinning. Use a lockfile and commit it. Avoid floating production dependencies.

## 3. Interfaces
- `Track`: stable internal metadata, provider identifier, source page URL, duration when known, requester ID, and playback reference only if the chosen engine/client requires it.
- `ProviderCapabilities`: search, resolveTrackUrl, resolvePlaylistUrl, metadata, playback.
- `MusicProvider`: capability declaration plus only the methods it supports.
- `MusicEngine`: connect/update voice session, load/play track, pause, resume, seek, set volume, stop, disconnect, and typed events.
- `GuildPlayer`: queue, current track, loop mode, connection state, and serialized state transitions.

Do not put all optional methods on an interface and silently throw “not supported”; use capability-specific interfaces or typed results.

## 4. Error model
Define typed errors: InvalidInput, UnsupportedProvider, NoResults, MetadataOnly, PlaybackNotPermitted, ProviderUnavailable, TrackUnavailable, VoicePermissionDenied, LavalinkUnavailable, QueueLimitExceeded, RateLimited, and InternalError. Map errors to safe user messages; detailed diagnostics go to redacted logs.

## 5. Timeouts and limits
- Set bounded timeouts for provider requests and Lavalink calls.
- Set configurable max query length, max playlist size, queue length, per-user request rate and volume.
- Do not retry permanent errors (unsupported source, permission denied).
- Retry only transient errors with bounded attempts and backoff.
- Make queue advancement idempotent per track-end event.

## 6. Build gates
Before merge: typecheck, lint, unit tests, build.
Before MVP release: integration test with Lavalink and an authorized test source, Discord voice end-to-end test, secret scan, manual permission test, and recovery test.
