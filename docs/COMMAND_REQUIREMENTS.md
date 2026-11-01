# Riffly — Complete Command Requirements Specification

Functional specification extracted from the platform architecture reference. All components, commands, interactions, and background jobs are strictly branded as **Riffly**.

---

## 1. Staff Hierarchy & Permission Architecture

Riffly enforces a 4-tier hierarchical permission system allowing authorized staff to execute operations even without native Discord permissions:

```
┌────────────────────────────────────────────────────────┐
│ Tier 1: Server Owner & Global Bot Owners (Full Root)   │
├────────────────────────────────────────────────────────┤
│ Tier 2: Extra Owner (Co-Owners — Full Bot Access)      │
├────────────────────────────────────────────────────────┤
│ Tier 3: Server Administrator (High / Senior Perms)     │
├────────────────────────────────────────────────────────┤
│ Tier 4: Server Moderator (Safe / Baseline Mod Perms)   │
└────────────────────────────────────────────────────────┘
```

### The 12 Bot Permission Flags:
1. `Ban`: `/ban`, `/softban`, `/tempban` (Mod: Disabled, Admin: Enabled)
2. `Unban`: `/unban` (Mod: Disabled, Admin: Enabled)
3. `Kick`: `/kick` (Mod: Enabled, Admin: Enabled)
4. `Channelutils`: `/lock`, `/unlock`, `/hide`, `/unhide`, `/lockall`, `/unlockall` (Mod: Enabled, Admin: Enabled)
5. `Warn`: `/warn`, `/warnings`, `/clearwarns`, `/note`, `/case`, `/editcase`, `/modlogs` (Mod: Enabled, Admin: Enabled)
6. `Nick`: `/nick` (Mod: Enabled, Admin: Enabled)
7. `Timeout`: `/timeout`, `/mute`, `/unmute` (Mod: Enabled, Admin: Enabled)
8. `Manageroles`: `/role add`, `/role remove`, `/role info`, `/role humans`, `/role bots`, `/role all` (Mod: Disabled, Admin: Enabled)
9. `Purge`: `/purge` (Mod: Enabled, Admin: Enabled)
10. `Slowmode`: `/slowmode` (Mod: Enabled, Admin: Enabled)
11. `Vcadmin`: `/move`, `/moveall`, `/vclock`, `/vcunlock`, `/vchide`, `/vcunhide`, `/jail` (Mod: Disabled, Admin: Enabled)
12. `Manageemojis`: `/steal`, `/emojiadd`, `/emojidelete` (Mod: Disabled, Admin: Enabled)

### Interactive Customization UI:
- Commands: `/mod add|edit`, `/admin add|edit`
- Components: Dynamic status embed, multi-select dropdown for the 12 permissions, "Grant All" button, "Save" button, "Cancel" button.

---

## 2. Complete Command Inventory by Category

### Category 1: Moderation
- `/ban <user> [delete_days] [reason]` — Ban member, optional prune (0-7d), DM user, log.
- `/unban <user_id> [reason]` — Unban user by ID.
- `/kick <user> [reason]` — Kick member, DM user, log.
- `/timeout <user> <duration> [reason]` — Built-in Discord timeout.
- `/mute <user> <duration> [reason]` — Timeout preset (1m, 5m, 10m, 30m, 1h, 6h, 12h, 1d, 3d, 7d).
- `/unmute <user> [reason]` — Remove timeout.
- `/warn <user> <reason>` — Issue infraction warning stored in DB, DM user, log.
- `/warnings <user> [type]` — View infractions (all/warn/mute/ban/note).
- `/clearwarns <user>` — Clear active warnings.
- `/softban <user> [reason]` — Ban + immediate unban to prune messages.
- `/tempban <user> <duration> [reason]` — Temporary ban (1h to 30d) with auto-unban background task.
- `/purge <amount>` — Bulk delete messages (up to 100). Auto-delete invocation and confirmation after 5s.
- `/slowmode <duration>` — Set channel rate limit (10s, 10m, 1h, 0 to disable).
- `/lock [channel] [role]` — Lock channel for role or @everyone.
- `/unlock [channel] [role]` — Unlock channel.
- `/lockall` — Lockdown all text channels.
- `/unlockall` — Unlock all text channels.
- `/hide [channel] [role]` — Hide channel.
- `/unhide [channel] [role]` — Unhide channel.
- `/vclock [channel] [role]` — Lock voice channel.
- `/vcunlock [channel] [role]` — Unlock voice channel.
- `/vchide [channel] [role]` — Hide voice channel.
- `/vcunhide [channel] [role]` — Unhide voice channel.
- `/nick <user> [nickname]` — Set or reset nickname.
- `/role add <user> <role>` — Add role validating hierarchy.
- `/role remove <user> <role>` — Remove role.
- `/role info <role>` — Role statistics (members, color, position).
- `/role bots <role>` — Mass assign role to bots.
- `/role remove-bots <role>` — Mass remove role from bots.
- `/role humans <role>` — Mass assign role to humans.
- `/role remove-humans <role>` — Mass remove role from humans.
- `/role all <role>` — Mass assign role to all members.
- `/role remove-all <role>` — Mass remove role from all members.
- `/note add <user> <note>` — Private staff note on user.
- `/note view <user>` — View staff notes.
- `/note remove <case_id>` — Remove staff note.
- `/move member <user> <destination_vc>` — Move user between VCs.
- `/move all <destination_vc> [source_vc]` — Mass move members between VCs.
- `/moveall <destination_vc>` — Move all voice members alias.
- `/case <id>` — View infraction case details.
- `/editcase <id> <reason>` — Edit infraction case reason.
- `/modlogs [user] [type]` — View recent mod actions.
- `/jail member <user> [reason]` — Strip roles and isolate in jail channel.
- `/jail remove <user>` — Restore original roles and release from jail.
- `/jail setup <role> <channel>` — Configure jail role and isolation channel.

### Category 2: Ticket System
- `/ticket setup <support_role> <log_channel> <category>` — Configure ticket infrastructure.
- `/ticket panel <channel> [title] [description]` — Post embed panel with "Open Ticket" button.
- `/ticket close [reason]` — Close ticket channel, render HTML/text transcript, post to log channel.
- `/ticket add <user>` — Grant member access to ticket.
- `/ticket remove <user>` — Revoke member access from ticket.
- `/ticket claim` — Claim ticket, append `-claimed` suffix to channel.
- `/ticket unclaim` — Release ticket claim.
- `/ticket rename <name>` — Rename ticket channel.
- `/ticket list` — List open tickets.

### Category 3: Verification
- `/verify setup <role> <channel> [description] [button_label]` — Configure role and panel.
- `/verify panel` — Post verification embed with Verify button.
- `/verify view` — Inspect verification config.

### Category 4: Leveling & Leaderboards
- `/rank [user]` — Display rank card (Message Level/XP/count, Voice Level/XP/minutes).
- `/setup-leveling [enabled] [xp_per_msg] [xp_per_vc_min] [channel] [roles]` — Configure leveling.
- `/leaderboard setup <channel> <type>` — Create persistent 15s auto-updating leaderboard embed.
- `/leaderboard remove <channel>` — Remove live auto-updating leaderboard.
- `/leaderboard list` — List registered live leaderboards.
- `/leaderboard view <type> [timeframe] [page]` — Instant paginated leaderboard with First/Prev/Next/Last buttons.
- `/reset all|xp|messages|voice|timeframe|daily|weekly|monthly` — Staff activity reset suite.

### Category 5: Voice Channels & VoiceMaster
- `/voicemaster setup` — One-click Join-to-Create hub setup.
- `/voicemaster disable` — Decommission VoiceMaster hub.
- `/vc limit <number> [channel]` — Set voice room user limit (0-99).
- `/vc rename <name> [channel]` — Rename voice room.
- `/vc lock [channel] [role]` — Lock voice room.
- `/vc unlock [channel] [role]` — Unlock voice room.
- `/vc hide [channel] [role]` — Hide voice room.
- `/vc unhide [channel] [role]` — Unhide voice room.
- `/vc permit <user>` — Whitelist user into locked voice room.
- `/vc ban <user>` — Kick and block user from voice room.
- `/vc transfer <user>` — Transfer channel ownership.
- `/setup-vc` — Admin configuration for Join-to-Create channel types.

### Category 6: Logging
- `/setup logs` / `/logging setup` — Instant one-click log setup: creates private category and 6 dedicated channels (`message-logs`, `voice-logs`, `member-logs`, `mod-logs`, `server-logs`, `bot-logs`).
- `/logging set <event_type> <channel>` — Set custom channel for specific log category.
- `/logging disable <event_type|all>` — Disable logging for category.
- `/logging view` — View configured log channels.

### Category 7: Security (Anti-Nuke, Anti-Raid, AutoMod)
- `/antinuke enable|disable|config|whitelist|view` — Threshold monitoring for bans (default 3), kicks (default 5), channel deletes (default 3) triggering action.
- `/antiraid enable|disable|config|view` — Rapid join detection (default 10 joins in 10s triggers lockdown + action).
- `/automod toggle|banned-words|thresholds|whitelist|view` — Heuristics for spam, links, caps, mentions, banned words.

### Category 8: Community Features & Automation
- `/giveaway start|end|reroll|list` — Giveaways with button entries and automated timer conclusion.
- `/poll <question> <options>` — Up to 10 options with reaction voting.
- `/invites [user]` — Invite tracking (joins, leaves, fake, total).
- `/timer create|list|cancel|pause|resume` — Named countdown timers.
- `/autorole add|remove|list` — Auto-role assignment for new members.
- `/reactionrole create|add|remove|list|delete` — Emoji-to-role interactive panels.
- `/vanityrole add|remove|list` — Role assignment based on user custom status text.
- `/starboard setup|disable|view` — Star threshold pinning.
- `/clownboard setup|disable|view|leaderboard` — Hall of shame with reaction trigger.
- `/counter setup|disable|view|reset` — One-number-per-person counting channel.
- `/autoresponder add|remove|list|clear|test` — Custom auto-replies (exact, startsWith, endsWith, contains).
- `/bumper setup|disable|view|bump` — Auto bump reminders (Disboard, Discadia, etc.).
- `/social <platform> add|remove|list` — Alerts for YouTube, Twitch, Reddit, TikTok, X, Instagram.
- `/boosterrole create|color|name|icon|delete` — Personal custom role for Nitro Boosters.

### Category 9: Utility & Info
- `/afk [reason]` — Set AFK status; notifies on mention; clears on next message.
- `/suggest <suggestion>` — Forward suggestion to channel with up/down reactions.
- `/report <user> <reason>` — Forward report to mod staff.
- `/announce <channel> <message> [role_ping] [color]` — Rich embed announcements.
- `/embed <json_or_builder>` — Send custom rich embed.
- `/avatar [user]` — High-resolution avatar display.
- `/servericon` / `/serverassets` — Server icon, banner, splash.
- `/roles` / `/emojis` / `/boosters` — Server breakdowns and counts.
- `/messages [user]` — User message count.
- `/snipe` / `/editsnipe` — Channel deleted/edited message memory.
- `/remind set|list|remove` — Persistent user reminders (10s to 30d).
- `/crypto price|top|gas|dominance` — CoinGecko live prices and gas.
- `/color info|random|rgb|palette` — Hex/RGB/HSL conversion and palette tools.
- `/weather current|forecast <location>` — OpenWeatherMap data.
- `/translate <text> <to> [from]` — Free translation (MyMemory).
- `/define <word>` — Dictionary lookup.
- `/wiki <query>` — Wikipedia summary.
- `/github user|repo|search` — GitHub lookup.
- `/steal <emoji|url> [name]` / `/emojiadd` / `/emojidelete` — Emoji management.
- `/help` — Interactive multi-category dashboard with select dropdown.
- `/info` — Bot uptime, ping, servers, version.

### Category 10: Virtual Economy
- `/economy balance [user]` — Wallet and bank balance.
- `/economy daily` — 500 coin daily reward (24h cooldown).
- `/economy beg` — Beg for spare coins with random outcomes.
- `/economy pay <user> <amount>` — P2P coin transfer.
- `/economy gamble <amount>` — 50/50 casino gamble.

### Category 11: Fun & Games
- `/rp <action> [user]` — 20+ anime roleplay actions (hug, kiss, slap, pat, tickle, etc.).
- `/image <effect> [user|image]` — Image filters (grayscale, invert, sepia, blur, etc.).
- `/tictactoe <opponent>` — Button-based Tic-Tac-Toe game.
- `/trivia [category] [difficulty]` — OpenTDB multiple-choice trivia with buttons.
- `/urban <term>` — Urban Dictionary definitions.
- `/fun 8ball|coinflip|roll|choose` — Classic fun tools.
- `/meme` — Reddit meme puller.
- `/fortnite stats|map|shop` — Fortnite tracker.

### Category 12: Administration, Setup & Templates
- `/setup-mod modlog|suggestions|reports|view` — Mod channel configuration.
- `/setup vc|logs|leveling` — One-click setup shortcuts.
- `/extraowner add|remove|list` — Co-owner management.
- `/admin add|edit|remove|list` — 12-perm Administrator management.
- `/mod add|edit|remove|list` — 12-perm Moderator management.
- `/prefix set|view` — Guild prefix configuration (default `!`).
- `/prefix noprefix-grant|noprefix-revoke|noprefix-list` — No-prefix access management.
- `/template save|load|view|list` — Server layout clone & restore (Everything, Channels only, Roles only, Full Replace).

---

## 3. Database Schema Mapping (Supabase PostgreSQL / Prisma)

The required tables are:
1. `guilds`: Server config, leveling settings, greet config.
2. `user_levels`: XP, levels, message counts, VC minutes.
3. `user_messages`: Per-channel message counts.
4. `user_activity_daily`: Daily message/VC for time-based leaderboards.
5. `infractions`: Warns, mutes, tempbans, softbans, notes.
6. `mod_settings`: Mod-log, suggestion, report channel per guild.
7. `ticket_settings`: Ticket system config per guild.
8. `tickets`: All ticket records (open and closed).
9. `ticket_panels`: Ticket panel messages.
10. `verification_settings`: Verification role, channel, button config.
11. `logging_settings`: Log channel per event type per guild.
12. `antinuke_settings`: Anti-nuke thresholds and whitelist.
13. `antiraid_settings`: Anti-raid config per guild.
14. `automod_settings`: Automod toggles, thresholds, banned words.
15. `autoroles`: Auto-role config per guild.
16. `reaction_roles`: Reaction role emoji-to-role mappings.
17. `vanity_roles`: Vanity status text-to-role mappings.
18. `invite_counters`: Invite tracking (joins, leaves, fake).
19. `giveaways`: Active and ended giveaways.
20. `timers`: Active countdown timers.
21. `afk`: AFK status per user per guild.
22. `suggestions`: Submitted suggestions.
23. `live_leaderboards`: Live leaderboard channel/message registrations.
24. `server_prefix`: Custom prefix per guild.
25. `no_prefix_exemptions`: No-prefix user exemptions with expiry.
26. `server_templates`: Saved server layout templates.
27. `reminders`: Personal user reminders with expiry.
28. `booster_roles`: Custom booster role per user per guild.
29. `voicemaster_settings`: VoiceMaster hub channel config per guild.
30. `voicemaster_channels`: Active VoiceMaster channels and owners.
31. `clownboards`: Clownboard config per guild.
32. `clownboard_messages`: Messages that made it to clownboard.
33. `counting_channels`: Counting channel config and state.
34. `bump_reminders`: Bump reminder config and last-bump tracking.
35. `social_alerts`: Social media alert subscriptions.
36. `staff_permissions`: Extra owners, custom admins, and custom mods with 12 permission bitfields.

