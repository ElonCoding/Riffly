# Security and Abuse Prevention

## Secrets
- `.env` is local only and must be gitignored.
- Commit `.env.example` with placeholders only.
- Never print bot tokens, Lavalink passwords, authorization headers, cookies, or full signed stream URLs.
- Rotate any secret accidentally committed or shared.

## Discord permissions
- Use least privilege; never require Administrator by default.
- Require the requester to be in a voice channel in the same guild.
- Check the bot can view/connect/speak in the target channel.
- Use Guilds and GuildVoiceStates intents as required; avoid privileged intents unless a documented feature needs them.
- Apply moderator/DJ permission checks to destructive controls.

## URL validation / SSRF
- Never request an arbitrary user URL from the bot backend.
- Allow only known provider hostnames and HTTPS where possible.
- Reject localhost, private, link-local, and internal IP destinations.
- Revalidate every redirect destination; preferably disable redirects for URL metadata fetches.
- Restrict ports and content types where applicable.
- Do not use provider URL text as a shell command or filesystem path.

## Resource controls
- Max query length, queue length, playlist entries, concurrent resolutions and per-user request rate.
- Timeouts and bounded retries.
- Limit volume and expensive filters.
- Protect against repeated interactions and duplicate track-end events.

## Privacy
- Store only required IDs and configuration.
- Avoid collecting message content or user data unrelated to music.
- Define log retention before public launch.
