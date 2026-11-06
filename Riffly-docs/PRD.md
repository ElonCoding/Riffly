# Product Requirements Document (PRD)

## 1. Product summary
A modular Discord bot platform whose first module is music playback. Users interact through Discord slash commands and controls. The initial design supports multiple eligible music sources behind one consistent request interface, without promising universal source compatibility.

## 2. Problem
Legacy bots can be confusing, unreliable, or difficult to extend. We want predictable playback, clear error messages, good queue behavior, safe permissions, and an architecture that can grow into other community modules.

## 3. Goals
- Deliver a working music MVP in a private test Discord server.
- Accept a song search query and supported, explicitly allowlisted track URLs.
- Keep catalogue search and audio playback capabilities distinct.
- Maintain independent player state per guild.
- Provide reliable queue controls and transparent failure behavior.
- Make source integrations replaceable through interfaces.
- Keep setup and operation reproducible.

## 4. Non-goals for MVP
- Universal playback from every streaming platform.
- Bypassing DRM, paywalls, access controls, or provider restrictions.
- A web dashboard, premium billing, AI chat, moderation suite, or mobile app.
- Kubernetes, microservices for every module, or multi-node clustering.
- Persistent storage of temporary stream URLs or credentials.

## 5. Personas
- Listener: requests songs and uses playback controls.
- Moderator/DJ: manages the queue and configured playback permissions.
- Bot operator: configures providers, secrets, deployment, and troubleshooting.

## 6. MVP features
### P0 — required
- `/ping` or equivalent health command.
- `/play <query-or-supported-url>`.
- Validate that requester is in a voice channel and bot can connect/speak.
- Resolve supported input through registered provider adapters.
- Play an authorized test track end-to-end.
- Per-guild queue; queue append; automatic next track.
- `/nowplaying`, `/queue`, `/pause`, `/resume`, `/skip`, `/stop`, `/leave`.
- Clear errors for unsupported URLs, no results, unavailable playback, permission errors, and source failure.
- Queue limits and request timeouts.
- Structured logs with secret redaction.
- Unit tests for classifier, resolver selection, queue transitions, and permission logic.

### P1 — after P0
- Shuffle, loop-one, loop-all, remove/move queue items.
- Configurable DJ role and maximum volume.
- Saved playlists and persistent guild settings.
- Reconnection and recovery improvements.
- Docker Compose local development for bot + Lavalink.

### Later modules
Moderation, utility commands, AI features, dashboard, analytics, and optional paid features. These must have separate requirements and cannot delay the music MVP.

## 7. UX rules
- Use Discord slash commands and ephemeral responses for private errors where appropriate.
- A search query should not silently switch to an unrelated track.
- A URL request should resolve that specific resource or explain why it is unsupported.
- Distinguish “found metadata” from “playable audio.”
- Never claim a track is playing until the audio engine confirms playback started.
- Show requester, title, source, and duration when known.
- Keep queue state consistent with audio-engine events.

## 8. Quality attributes
- Reliability: recover from expected provider/player errors without crashing the bot.
- Security: least-privilege Discord permissions, secret hygiene, safe URL validation.
- Maintainability: modular services and typed contracts.
- Observability: actionable logs and understandable user-facing errors.
- Portability: local development on Windows and Linux deployment.
- Compliance: each provider integration must be reviewed for permitted access and playback use.

## 9. MVP acceptance criteria
- A new developer can follow README and run the bot locally.
- Slash commands register in a private test guild.
- `/ping` returns a response.
- `/play` rejects empty input, unsupported URL schemes, unknown domains, and users not in voice.
- At least one permitted test audio source plays end-to-end in Discord voice.
- Queue isolation is proven with two test guilds or isolated player unit tests.
- Track-end advances the queue exactly once.
- Source errors produce a user-visible message and leave player state consistent.
- Automated typecheck, lint (if configured), tests, and build pass.
- No secrets are committed or written to logs.

## 10. Success metrics for initial testing
- Successful-play rate for the configured test source.
- Median time from `/play` to playback-start event.
- Track resolution failure rate by provider.
- Unexpected player disconnects.
- Queue transition correctness in automated tests.
Metrics must be instrumented before reporting numeric results.
