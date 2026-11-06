# Implementation Tasks for Coding Agents

Work top-to-bottom. Do one task per change set; run relevant checks after each.

## Task 1 — Audit the starter ✅
- Inspect all existing files.
- Run install, typecheck, and build.
- Report issues before making broad changes.
Acceptance: current state and exact command results are documented.

## Task 2 — Stabilize foundation ✅
- Fix compile/type errors.
- Add ESLint, Prettier, and Vitest if absent.
- Add tests for config validation and command input.
Acceptance: typecheck, lint, tests, build pass.

## Task 3 — Verify Lavalink client choice ✅
- Check current official Lavalink docs and the selected client repository/types.
- Record versions and compatibility in `DECISIONS.md`.
- Do not implement based on guessed method names.
Acceptance: documented verified client/version and minimal connection proof.

## Task 4 — Local Lavalink service ✅
- Add local Docker Compose or documented local process setup.
- Keep passwords in environment configuration.
- Ensure Lavalink port is not exposed publicly by default.
Acceptance: bot can reach node locally; invalid password fails safely.

## Task 5 — MusicEngine adapter ✅
- Implement typed connect/play/pause/resume/skip/stop/disconnect operations.
- Map Lavalink events into internal events.
- Add unit tests with a fake engine.
Acceptance: tests cover lifecycle and failure transitions.

## Task 6 — Provider interface and safe input classification ✅
- Implement exact-host allowlist and provider capabilities.
- Separate search metadata from playable source.
- Add URL safety tests.
Acceptance: unknown/unsafe URLs fail closed.

## Task 7 — First permitted source
- Configure an owned/licensed test asset or a source with documented permission for this use.
- Play it end-to-end in a private Discord server.
Acceptance: actual audible playback confirmed and documented.
Note: Lavalink built-in SoundCloud source is configured. Start Lavalink with docker-compose
then run `npm run register:commands` and test `/play <soundcloud URL>` in Discord.

## Task 8 — Queue ✅
- Implement per-guild queue, serialized transitions, queue caps and idempotent track-end handling.
Acceptance: queue unit tests and two-guild isolation tests pass.

## Task 9 — Commands ✅
- Implement nowplaying, queue, pause, resume, skip, stop, leave.
- Add permission checks and user-friendly error mapping.
Acceptance: manual command test checklist passes.

## Task 10 — Release gate
- Run complete test plan and security checks.
- Update README/runbook with actual results.
Acceptance: all P0 requirements pass; no fabricated results.
