# Releases

## Release — Version 2.0.0 (Enterprise Modular Expansion)

**Version 2.0.0** transforms Riffly into an enterprise-grade modular Discord platform featuring a battle-tested music engine, DAG-ordered module architecture, persistent task scheduler, comprehensive server management, and real-time management dashboard.

### Audio & Music Engine

- **5-State Deterministic Audio FSM**: (`disconnected` → `idle` → `buffering` → `playing` → `paused`) eliminating race conditions.
- **Async Gateway Handshake**: Synchronizes voice channel connection before Lavalink player dispatch (`C-01`).
- **Truthful Pause/Resume State**: Emits accurate feedback matching Lavalink engine state (`DEF-02`).
- **Skip Deduplication & Concurrency Locks**: FIFO `AsyncMutex` and advancing locks preventing duplicate skip events.
- **Circuit Breaker**: Trips playback after 3 consecutive errors within 5000ms (`C-05`).
- **180s Inactivity Disconnect**: Disconnects cleanly on idle queues (`C-06`).
- **Loop Crash Guard**: Fixes index corruption on empty queues (`C-04`).
- **Audio Equalization & DSP Filters**: `/filter` with `bassboost`, `nightcore`, `vaporwave`, `8d`, `tremolo`, `karaoke`, and `clear`.
- **Smart Autoplay**: Automatic queue continuation with recommendations (`/autoplay`).
- **Interactive Component Controls**: Real-time Discord button controls (`riffly_pause`, `riffly_resume`, `riffly_skip`, `riffly_stop`, `riffly_loop`, `riffly_shuffle`).

### Modular Architecture & Database

- **Topological DAG Registry**: Declarative module loader with dependency resolution and lifecycle hooks (`ModuleRegistry`).
- **Priority Event Dispatcher**: Guild-scoped priority event buses for Gateway events (`EventDispatcher`).
- **Persistent Task Scheduler**: Database-backed job queue with exponential backoff and retry handling (`TaskScheduler`).
- **Prisma PostgreSQL Persistence**: Structured models for Guilds, Moderation, Tickets, Levels, Giveaways, Economy, and Tasks.

### Platform Modules

- **Moderation & Server Logging**: Cases, `/ban`, `/kick`, `/timeout`, `/warn`, `/cases`, `/purge`, and full audit event dispatchers.
- **Tickets & Verification**: Ticket creation, claiming, transcript exports, and button verification panels.
- **Voice Rooms & Leveling**: Dynamic Join-to-Create voice channels and non-linear XP leveling with rank cards.
- **AutoMod & Security**: PatternGuard regex engine (anti-invite, anti-link, anti-caps, mention spam, rate-limits).
- **Starboard & Giveaways**: Reaction starboard embeds and scheduled lottery giveaways with button entries.
- **Virtual Economy**: Balances, daily claims, work shifts, peer transfers, and bank deposits/withdrawals.
- **Contextual AI Assistant**: `/ask` knowledge assistant answering bot and server questions.
- **Server Preservation**: Structural backups of guild channels, roles, and permissions (`/backup`).

### Web UI Dashboard & REST API

- Built-in HTTP server with sub-millisecond response times.
- Interactive Web Portal at `/dashboard` with live playback controls.
- OpenAPI 3.0 Specification at `/api/openapi.json` and interactive Swagger UI at `/api/docs`.

### Test Suite

- **415 automated unit & integration tests** across 58 test suites (Vitest).

---

## Release — Version 1.0.0

- Modular player engine and audio engine with test doubles.
- Slash command suite: `/play`, `/pause`, `/resume`, `/skip`, `/stop`, `/queue`, `/nowplaying`, `/join`, `/leave`, `/ping`.
- Lavalink v4 integration via `lavalink-client`.
- Query classification and sanitization.
- Multi-stage Dockerfile and Render single-service configuration.
- 77 automated Vitest unit tests.
