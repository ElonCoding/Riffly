# Roadmap

## M0 — Repository and bot foundation
- TypeScript strict project and env validation.
- Discord client, slash command deployment, `/ping`.
- CI checks and documented local setup.
Exit: bot connects and `/ping` works in a private server.

## M1 — Audio spike
- Choose and verify a maintained Lavalink client.
- Run Lavalink locally.
- Configure one permitted test source.
- Implement voice handshake and one-track playback.
Exit: audible authorized test track plays end-to-end.

## M2 — Music MVP
- Input classifier and provider registry.
- `/play` query + allowlisted track URL.
- Queue and core controls.
- Error handling, limits, logs and tests.
Exit: all P0 criteria pass.

## M3 — Reliability
- Retry policy, reconnection, queue persistence decision.
- Load and multi-guild tests.
- Docker Compose and CI.
Exit: documented operational behavior and recovery tests.

## M4 — Provider expansion
- Add one provider at a time after a policy/technical review.
- Test source outages, API limits, and playback eligibility.
Exit: provider-specific acceptance tests pass.

## M5 — Additional bot modules
- Moderation, utilities, AI, dashboard only after product requirements are defined.
