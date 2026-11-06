# Instructions for AI Coding Agents

## Mission
Build a maintainable, secure, modular Discord bot. The first release is a working music MVP. Do not implement future modules until the current milestone's acceptance criteria pass.

## Source-of-truth precedence
1. `DECISIONS.md` for confirmed decisions.
2. `PRD.md` for product scope and acceptance criteria.
3. `ARCHITECTURE.md`, `TRD.md`, and `MUSIC_PIPELINE.md` for implementation constraints.
4. `SECURITY.md` and `TEST_PLAN.md` for mandatory quality gates.
5. `TASKS.md` for current task order.
If documents conflict, stop and report the conflict; do not silently choose.

## Anti-hallucination rules
- Do not invent provider capabilities, URLs, API methods, package names, permissions, environment variables, or test results.
- Verify current APIs against official docs or installed package types before coding.
- If external documentation cannot be accessed, mark the point as `UNVERIFIED` and ask or create a clearly isolated adapter stub.
- Do not claim a command works unless you ran it and observed success.
- Do not claim audio playback works until an end-to-end test plays an authorized test asset in a Discord voice channel.
- Do not treat search metadata, a song URL, or a Spotify link as permission or capability to stream audio.
- Do not implement scraping, DRM circumvention, credential sharing, or source integrations that violate applicable terms.
- Do not put real secrets in source files, docs, logs, screenshots, tests, or commits.

## Engineering rules
- TypeScript strict mode; avoid `any`. If unavoidable, justify it and constrain its scope.
- Use small modules with explicit interfaces and dependency injection where practical.
- Slash commands should validate input, respond within Discord interaction deadlines, and handle failures.
- Each guild must have isolated player/queue/settings state.
- All external calls need timeouts, error mapping, and appropriate rate limiting.
- Never fetch arbitrary user-provided URLs. Validate scheme and exact hostname against a provider allowlist; handle redirects safely.
- Use structured logs; redact tokens, passwords, authorization headers, and sensitive URL query parameters.
- Add or update tests with every behavior change.
- Avoid premature microservices. Lavalink is a separate audio process; other features stay in the bot until scale warrants separation.
- Do not add AI, dashboard, subscriptions, or database infrastructure before the current milestone requires them.

## Workflow
1. Read all documents listed in README.md.
2. Inspect the existing repository and report current state before editing.
3. State the milestone and the exact files expected to change.
4. Implement the smallest vertical slice.
5. Run typecheck, lint, tests, and build commands that actually exist.
6. Report commands run, observed results, limitations, and next task.
7. Do not make destructive changes or deploy publicly without explicit approval.

## Required completion report
- Summary
- Files changed
- Decisions made
- Tests/commands run and their real results
- Unverified items / blockers
- Next task
