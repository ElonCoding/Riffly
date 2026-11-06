# Test Plan

## Unit tests
- Input classifier: query, valid known-host URL, unknown host, non-HTTP scheme, credentials in URL, malformed URL, empty input, oversized input.
- Provider registry: capability filtering and unsupported provider behavior.
- Resolver: exact URL intent, ranking, no results, metadata-only candidate, playback-ineligible candidate.
- Queue: FIFO, skip, clear, loop-one, loop-all, duplicate track-end event, queue limit.
- Guild isolation: mutations in guild A do not affect guild B.
- Error mapping: safe user messages without secret leakage.

## Integration tests
- Bot starts with valid environment config.
- Missing config fails fast with actionable error.
- Slash commands deploy to a test guild.
- Bot connects to Lavalink and handles node unavailable state.
- Lavalink loads a permitted test asset.
- Player events map to queue transitions.
- Reconnection behavior does not duplicate playback or advance the queue twice.

## End-to-end manual gate
1. Invite bot to a private test server with least-privilege permissions.
2. Join a test voice channel.
3. Run `/play` with a permitted test asset.
4. Confirm audible playback from a second Discord account/client.
5. Pause/resume/skip/stop and verify UI/state.
6. Test source failure and voice disconnect.
7. Test two guilds concurrently or verify isolated player-manager tests.
8. Verify logs contain no secrets.

## Release gate
No public release until all P0 acceptance criteria in PRD.md pass and actual test output is recorded. Do not fabricate passing tests.
