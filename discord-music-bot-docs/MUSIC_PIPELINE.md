# Music Source and Playback Pipeline

## 1. Core distinction
Catalogue search, metadata resolution, and audio playback are separate capabilities. A source may legally/technically expose search results without authorizing stream playback in a Discord bot. The app must not infer playback rights from the existence of a URL.

## 2. Input forms
- Search query: free text.
- Track URL: provider-recognized URL to one track.
- Playlist URL: provider-recognized playlist, subject to a configured item cap.
Unknown URLs must fail closed with an actionable message.

## 3. Resolution algorithm
1. Normalize whitespace and enforce input length.
2. If input resembles a URL, parse it using the standard URL parser.
3. Allow only HTTP(S), reject embedded credentials, and match exact hostnames against an allowlist.
4. Never fetch arbitrary URLs or follow redirects without revalidating each destination.
5. Select adapter by exact hostname/provider ID.
6. Ask adapter to resolve the exact resource; do not silently search a different song when a URL fails.
7. For text search, query only configured providers that support search.
8. Normalize candidates and rank by title/artist/duration and provider confidence.
9. Filter candidates by playback eligibility and current policy.
10. If only metadata is available, tell the user rather than pretending playback is possible.
11. Add selected Track to the guild queue; start playback only when queue/player state allows.
12. Record safe diagnostics and emit user-facing status.

## 4. Source policy
- Provider adapters must be reviewed for current terms, API rules, licences, authentication, geographic restrictions, and redistribution restrictions.
- Spotify Web API metadata/search is not authorization to extract or rebroadcast Spotify audio.
- Do not implement DRM circumvention, stream ripping, session-cookie harvesting, or bypassing access controls.
- Prefer audio files we own or are explicitly licensed to stream for the first end-to-end test.
- Keep source integrations behind interfaces so a provider can be disabled without breaking core queue logic.

## 5. Lavalink integration
- Run Lavalink as a separate service.
- Use a maintained compatible client library; verify its API and version against official docs/types.
- Store Lavalink password in environment/secrets, never in source.
- Complete Discord voice handshake and pass voice-state/server updates as required by the client.
- Map player events into a typed internal event model.
- Handle node disconnect/reconnect and player recreation deliberately.
- Treat playback references as ephemeral.
- Do not claim playback success until a start event confirms it.

## 6. Playlist policy
- Resolve playlist metadata with a hard item limit.
- Report skipped/unavailable entries.
- Avoid loading huge playlists into memory or issuing unbounded parallel requests.
- Enqueue in stable order and handle duplicate events idempotently.
