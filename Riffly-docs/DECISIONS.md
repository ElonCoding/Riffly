# Architecture Decisions and Open Questions

## Confirmed
- Primary language: TypeScript.
- Runtime: supported Node.js LTS release; pin after checking current compatibility.
- Discord library: discord.js.
- Audio architecture: Lavalink v4.x behind an internal MusicEngine abstraction.
- Lavalink client: `lavalink-client` (v2.11.x) selected for Lavalink v4 compatibility with discord.js v14.
- Audio server runtime: Java 17+ or 21 (Eclipse Temurin) for Lavalink v4.
- User input: text query and recognized track/playlist URLs.
- Source architecture: multiple provider adapters behind one resolver interface.
- Initial deployment: local development first; long-running host for production.
- Scope order: music MVP before other modules.
- No assumption that any specific commercial provider allows rebroadcasting audio.

## Assumptions to validate
- At least one permitted source can be configured for a working end-to-end test.
- Verify plugin compatibility (e.g. YouTube/LavaSearch plugins) against Lavalink v4 server if needed.

## Open questions
- Final bot name and branding.
- Public bot or private/community bot for first release.
- First permitted audio source and exact licence/terms.
- Whether playlists are P0 or P1 (current recommendation: P1).
- Whether PostgreSQL is needed in MVP (current recommendation: no, unless persistent settings are immediately required).
- Production host, budget, and expected guild count.
- Meaning of “RDA” in the user's preferred document set.

## Decision policy
Any change to the confirmed architecture must update this file and the affected PRD/TRD/architecture docs. AI agents must not silently alter confirmed decisions.
