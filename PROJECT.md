# Project: Riffly — Music Engine Repair & Platform Expansion

## Architecture Overview
Riffly is a high-performance Discord application built with TypeScript and Discord.js v14. The platform architecture is structured into two major subsystems:
1. **Audio & Music Engine Subsystem** (`src/audio/`, `src/player/`, `src/provider/`):
   - Backed by Lavalink (via `lavalink-client` v2) for remote audio decoding, streaming, and voice connection management.
   - Layered architecture:
     - `LavalinkMusicEngine` (`src/audio/`): Manages Lavalink node connectivity, raw player state, voice server/state updates, and audio streams.
     - `GuildPlayerManager` & `GuildQueue` (`src/player/`): Guild-scoped queue management, player lifecycle state machine, track advancement, volume, loop modes, and inactivity timeouts.
     - `TrackResolver` & `LavalinkProvider` (`src/provider/`): URL and query classification, search dispatch, track/playlist resolution, and hostname whitelisting.
     - Command & UI Handlers (`src/commands/`): Slash command definitions, interaction validation, permissions, and component button collectors.
2. **Modular Platform Subsystem** (`src/modules/`, `src/database/`):
   - Designed for comprehensive Discord server administration, community engagement, and security.
   - Structured around a declarative, strongly-typed module contract (`defineModule`) with isolated event dispatching, debounced per-guild REST command synchronization, and persistent task scheduling.
   - Backed by Supabase + PostgreSQL via centralized Prisma ORM.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Music Architecture Audit | Full codebase audit, dependency inspection, and bug tracing | Milestone A | Survey / Request §1 |
| 2 | Reference Architecture Analysis | Technical study of reference queue, playback flow, and modular systems | Milestone A | Survey / Request §2.1 & §3 |
| 3 | Root Cause Diagnosis | Identify race conditions and state desyncs in /play, /pause, /resume, /skip | Milestone A | Survey / Request §2.2 & §2.3 |
| 4 | Repair Plan & Test Strategy | Document complete technical repair plan and regression test suite design | Milestone A | Survey / Request §2.6 & §6 |
| 5 | Async Voice Connection Fix | Ensure player waits for Discord gateway voice handshake before playback | Milestone B | Survey §2.2 |
| 6 | Reliable Pause/Resume State Machine | Decouple pause/resume from strict `playing` flag; align with Lavalink v2 | Milestone B | Survey §2.3 |
| 7 | Skip Double-Advance Fix | Filter `trackEnd` events (`reason === 'stopped'/'replaced'`) on manual skip | Milestone B | Survey §2.4 |
| 8 | Concurrency Queue Mutex (`queueLock`) | Protect track transitions from quick-play and concurrent interaction races | Milestone B | Survey §2.2 |
| 9 | Inactivity Idle Timer (`waitTimeout`) | Automatically leave voice channel after configurable idle period | Milestone B | Survey §2.1 |
| 10 | Voice Channel Guard (`canModifyQueue`) | Require user to be in the same voice channel as the bot to modify playback | Milestone B | Survey §2.1 |
| 11 | Interaction Deferral & Safety | Safe `deferReply` / `editReply` across all music commands to prevent timeouts | Milestone B | Survey §2.2 |
| 12 | Track Error & Stuck Recovery | Auto-advance queue gracefully on stream decoder failures or stuck tracks | Milestone B | Survey §2.5 |
| 13 | Playlist Resolution | Implement `resolvePlaylistUrl` for SoundCloud sets and playlists | Milestone C | Survey §2.4 |
| 14 | Complete Music Commands | Audit and verify /stop, /queue, /nowplaying, /volume, /loop, /shuffle, /seek, /remove, /clear | Milestone C | Survey §2.4 |
| 15 | Interactive Music Controls | Enable button & select menu collectors in `src/interaction.ts` for music UI | Milestone C | Survey §2.3 & §2.4 |
| 16 | Comprehensive Music Unit/E2E Tests | 100% test coverage for music commands and Lavalink lifecycle integration | Milestone C | Survey §2.6 |
| 17 | Modular System Core Architecture | `defineModule` contract, module loader, settings schema DSL, lifecycle hooks | Milestone D | Request §3 & §6 |
| 18 | Centralized Event Dispatcher | Error-isolated event delivery with priority ordering (e.g. ticket priority) | Milestone D | Request §3 & §6 |
| 19 | Per-Guild Command Sync & Policies | REST guild command registration with 5s debounce, role/channel overrides | Milestone D | Request §3 & §6 |
| 20 | Persistent Task Scheduler | Atomic database task scheduler polling every 15s for delayed jobs | Milestone D | Request §3 & §6 |
| 21 | Database Persistence (Prisma + Supabase) | Centralized Prisma Client, PostgreSQL models, migrations, and transactions | Milestone D | Request §4 |
| 22 | Decoupled Music Module Integration | Wrap `GuildPlayerManager` in `src/modules/music/` without coupling internals | Milestone D | Request §3 & §6 |
| 23 | Moderation System | Ban, unban, kick, timeout, warn, mute, softban, tempban, purge, slowmode, lock, case history | Milestone E | Request §3.1 |
| 24 | Server Logging & Audit Logs | Message edits/deletes, member joins/leaves, voice activity, mod events, config changes | Milestone E | Request §3.1 |
| 25 | Ticket Management | Ticket panels, creation, categories, claim/unclaim, transcripts, ticket logs | Milestone F | Request §3.1 |
| 26 | Verification & Onboarding | Verification panels, verification roles, welcome/goodbye, auto-roles | Milestone F | Request §3.1 |
| 27 | Voice Management (Join-to-Create) | Temporary channels, ownership, rename, user limits, lock/unlock, permit/deny | Milestone G | Request §3.1 |
| 28 | XP & Leveling System | Message XP, voice XP, rank cards, leaderboards, role rewards | Milestone G | Request §3.1 |
| 29 | AutoMod & Server Security | Anti-spam, anti-link, anti-caps, mention spam, banned words, anti-raid, anti-nuke | Milestone H | Request §3.1 |
| 30 | Community Engagement & Utilities | Giveaways, polls, starboard, suggestions, reminders, translations, weather, trivia | Milestone H | Request §3.1 |
| 31 | Web Dashboard | Discord OAuth2, guild settings, mod logs, ticket management, music controls | Milestone I | Request §3.1 |

## Milestones
| # | Milestone Name | Scope | Dependencies | Status |
|---|----------------|-------|-------------|--------|
| A | Music System Audit & Diagnosis | Codebase audit, bug tracing, reference architecture analysis, repair & test plan, ADR-001 | None | DONE |
| B | Music Engine Core Repair | Fix voice connection handshake, pause/resume FSM, double-skip, queueLock, deferral | Milestone A | DONE |
| C | Music Feature Completion & Testing | Playlist resolution, full command suite, interactive buttons, unit/integration tests | Milestone B | DONE |
| D | Core Bot Architecture & Persistence | Modular contract (`defineModule`), event dispatcher, Prisma schema, scheduler | Milestone C | DONE |
| E | Moderation & Server Logging | Moderation cases, sanctions, case numbering, message/member/mod loggers | Milestone D | DONE |
| F | Tickets & Verification | Ticket panels, streaming transcripts, verification flows, auto-roles | Milestone E | IN PROGRESS |
| G | Voice Rooms & Leveling | Join-to-create temporary voice channels, voice/chat XP, rank cards, leaderboards | Milestone F | PLANNED |
| H | AutoMod, Security & Community | PatternGuard anti-spam/link/caps/raid, giveaways, polls, starboard, utilities | Milestone G | PLANNED |
| I | Web Dashboard & Advanced Systems | OAuth2 web dashboard, REST control API, virtual economy, AI assistant | Milestone H | PLANNED |

## Interface Contracts

### 1. Discord Interaction <-> Music Commands
```typescript
interface CommandContext {
  interaction: ChatInputCommandInteraction;
  guildId: string;
  member: GuildMember;
  voiceChannelId: string;
}

// All music commands MUST follow safe interaction lifecycle:
// 1. Validate permissions and voice channel
// 2. await interaction.deferReply({ ephemeral?: boolean })
// 3. Delegate to GuildPlayerManager
// 4. await interaction.editReply({ embeds: [...], components?: [...] })
```

### 2. Music Player Manager <-> Lavalink Engine
```typescript
export type PlayerState = 'idle' | 'buffering' | 'playing' | 'paused' | 'disconnected';

export interface IMusicEngine {
  join(guildId: string, channelId: string): Promise<void>;
  leave(guildId: string): Promise<void>;
  play(guildId: string, track: Track): Promise<void>;
  pause(guildId: string): Promise<void>;
  resume(guildId: string): Promise<void>;
  stop(guildId: string): Promise<void>;
  seek(guildId: string, positionMs: number): Promise<void>;
  setVolume(guildId: string, volume: number): Promise<void>;
  getState(guildId: string): PlayerState;
  on(event: 'trackStart' | 'trackEnd' | 'trackError' | 'trackStuck' | 'nodeConnect' | 'nodeDisconnect', listener: Function): this;
}
```

### 3. Track Resolver <-> Lavalink Provider
```typescript
export interface ITrackResolver {
  resolve(input: string): Promise<ResolutionResult>;
}

export interface ResolutionResult {
  type: 'track' | 'playlist' | 'search';
  tracks: Track[];
  playlistName?: string;
}
```

### 4. Modular Platform Contract (Milestone D)
```typescript
export interface ModuleDefinition<S extends Shape> {
  id: string;
  name: string;
  description: string;
  alwaysOn?: boolean;
  settings?: S;
  commands?: CommandDefinition[];
  events?: EventListenerDefinition[];
  tasks?: ScheduledTaskDefinition[];
  onEnable?: (ctx: ModuleContext<S>) => Promise<void>;
  onDisable?: (ctx: ModuleContext<S>) => Promise<void>;
}
```

## Code Layout & Write Boundaries
- `src/audio/`: Lavalink node lifecycle, WebSocket events, and audio streaming engine. Owned by Audio Engine Worker.
- `src/player/`: Per-guild queue, player state machine, playback concurrency locks. Owned by Player Worker.
- `src/provider/`: Provider registry, URL classifier, search resolution. Owned by Provider Worker.
- `src/commands/`: Slash command definitions and Discord interaction handlers. Owned by Command Worker.
- `src/modules/`: Modular platform feature implementations (Milestone D+).
- `src/database/` / `prisma/`: Prisma schema, migrations, and database client (Milestone D+).
- `tests/`: Vitest unit and integration test suites. Owned by Test Writers.

## Critical IP & Branding Requirements
- Riffly is an independent platform branded exclusively as Riffly.
- Reference repositories are technical reference material ONLY.
- Under NO circumstance shall any external reference project's name, branding, logos, or user-facing text appear anywhere in code, comments, documentation, embeds, or test fixtures.

