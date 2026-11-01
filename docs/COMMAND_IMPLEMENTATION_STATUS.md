# Riffly — Command Implementation Coverage Matrix

Comprehensive audit comparing the target specification against current Riffly implementation.

| Category | Command / Feature | Exists | Functional | Tested | Action Required |
|---|---|---|---|---|---|
| **Staff & Hierarchy** | `/extraowner add\|remove\|list` | ❌ No | ❌ No | ❌ No | Implement Tier 2 Extra Owner system |
| **Staff & Hierarchy** | `/admin add\|edit\|remove\|list` | ❌ No | ❌ No | ❌ No | Implement Tier 3 Administrator + 12-perm UI |
| **Staff & Hierarchy** | `/mod add\|edit\|remove\|list` | ❌ No | ❌ No | ❌ No | Implement Tier 4 Moderator + 12-perm UI |
| **Staff & Hierarchy** | Staff Hierarchy Engine | ❌ No | ❌ No | ❌ No | Implement 4-tier permission evaluation & cache |
| **Moderation** | `/ban` | ⚠️ Partial | ✅ Yes | ✅ Yes | Expand optional delete_days (0-7d), DM, modlog |
| **Moderation** | `/unban` | ❌ No | ❌ No | ❌ No | Implement unban by ID |
| **Moderation** | `/kick` | ⚠️ Partial | ✅ Yes | ✅ Yes | Add DM user + mod-log posting |
| **Moderation** | `/timeout` | ⚠️ Partial | ✅ Yes | ✅ Yes | Integrate with infraction store + modlog |
| **Moderation** | `/mute` / `/unmute` | ❌ No | ❌ No | ❌ No | Implement duration presets + unmute |
| **Moderation** | `/softban` | ❌ No | ❌ No | ❌ No | Implement ban + immediate unban prune |
| **Moderation** | `/tempban` | ❌ No | ❌ No | ❌ No | Implement tempban with 5m scheduler unban |
| **Moderation** | `/warn` / `/warnings` / `/clearwarns` | ⚠️ Partial | ✅ Yes | ✅ Yes | Expand `/warnings` filter & `/clearwarns` |
| **Moderation** | `/purge` | ⚠️ Partial | ✅ Yes | ✅ Yes | Add 5s auto-delete cleanup |
| **Moderation** | `/slowmode` | ❌ No | ❌ No | ❌ No | Implement channel slowmode command |
| **Moderation** | `/lock` / `/unlock` | ❌ No | ❌ No | ❌ No | Implement channel permission lock/unlock |
| **Moderation** | `/lockall` / `/unlockall` | ❌ No | ❌ No | ❌ No | Implement server-wide channel lockdown |
| **Moderation** | `/hide` / `/unhide` | ❌ No | ❌ No | ❌ No | Implement channel visibility toggle |
| **Moderation** | `/vclock` / `/vcunlock` | ❌ No | ❌ No | ❌ No | Implement voice channel lock/unlock |
| **Moderation** | `/vchide` / `/vcunhide` | ❌ No | ❌ No | ❌ No | Implement voice channel hide/unhide |
| **Moderation** | `/nick` | ❌ No | ❌ No | ❌ No | Implement nickname change/reset |
| **Moderation** | `/role add\|remove\|info` | ❌ No | ❌ No | ❌ No | Implement role management with hierarchy check |
| **Moderation** | `/role bots\|humans\|all` | ❌ No | ❌ No | ❌ No | Implement mass role assignment & removal |
| **Moderation** | `/note add\|view\|remove` | ❌ No | ❌ No | ❌ No | Implement staff moderation notes |
| **Moderation** | `/move member\|all` / `/moveall` | ❌ No | ❌ No | ❌ No | Implement voice member move & mass move |
| **Moderation** | `/case` / `/editcase` | ⚠️ Partial | ⚠️ Partial | ⚠️ Partial | Add editcase reason update & case view |
| **Moderation** | `/modlogs` | ❌ No | ❌ No | ❌ No | Implement filterable mod action logs |
| **Moderation** | `/jail member\|remove\|setup` | ❌ No | ❌ No | ❌ No | Implement isolation role stripping & restoration |
| **Tickets** | `/ticket setup\|panel` | ⚠️ Partial | ✅ Yes | ✅ Yes | Wire custom panels, roles, categories |
| **Tickets** | `/ticket close\|add\|remove` | ✅ Yes | ✅ Yes | ✅ Yes | Verify transcripts & permissions |
| **Tickets** | `/ticket claim\|unclaim\|rename\|list` | ⚠️ Partial | ✅ Yes | ✅ Yes | Add unclaim & rename |
| **Verification** | `/verify setup\|panel\|view` | ⚠️ Partial | ✅ Yes | ✅ Yes | Add setup & view config commands |
| **Leveling** | `/rank` | ✅ Yes | ✅ Yes | ✅ Yes | Add voice XP metrics & message counters |
| **Leveling** | `/setup-leveling` | ❌ No | ❌ No | ❌ No | Implement leveling configuration command |
| **Leveling** | `/leaderboard setup\|remove\|list` | ❌ No | ❌ No | ❌ No | Implement 15s auto-updating live leaderboards |
| **Leveling** | `/leaderboard view` | ⚠️ Partial | ✅ Yes | ✅ Yes | Add timeframes (Daily/Weekly/Monthly) + pagination |
| **Leveling** | `/reset all\|xp\|messages\|voice` | ❌ No | ❌ No | ❌ No | Implement staff activity reset suite |
| **VoiceMaster** | `/voicemaster setup\|disable` | ❌ No | ❌ No | ❌ No | Implement VoiceMaster hub creation |
| **VoiceMaster** | `/vc limit\|rename\|lock\|unlock` | ⚠️ Partial | ✅ Yes | ✅ Yes | Unify under VoiceMaster schema |
| **VoiceMaster** | `/vc hide\|unhide\|permit\|ban\|transfer` | ❌ No | ❌ No | ❌ No | Implement permit, ban, transfer |
| **Logging** | `/setup logs` / `/logging setup` | ❌ No | ❌ No | ❌ No | One-click 6-channel log category generator |
| **Logging** | `/logging set\|disable\|view` | ❌ No | ❌ No | ❌ No | Configurable channel per log event |
| **Security** | `/antinuke enable\|disable\|config\|whitelist`| ❌ No | ❌ No | ❌ No | Rapid ban/kick/channel delete interceptor |
| **Security** | `/antiraid enable\|disable\|config` | ❌ No | ❌ No | ❌ No | Rapid join rate limiter + auto lockdown |
| **Security** | `/automod toggle\|banned-words\|whitelist` | ⚠️ Partial | ✅ Yes | ✅ Yes | Expose slash configuration interface |
| **Community** | `/giveaway start\|end\|reroll\|list` | ⚠️ Partial | ✅ Yes | ✅ Yes | Add reroll and early end commands |
| **Community** | `/poll` | ✅ Yes | ✅ Yes | ✅ Yes | Verify 10 option reaction poll |
| **Community** | `/invites` / `/invites user` | ❌ No | ❌ No | ❌ No | Implement invite tracker cache & command |
| **Community** | `/timer create\|list\|cancel\|pause\|resume` | ❌ No | ❌ No | ❌ No | Implement channel countdown timers |
| **Community** | `/autorole add\|remove\|list` | ❌ No | ❌ No | ❌ No | Implement join autorole engine |
| **Community** | `/reactionrole create\|add\|remove\|list` | ❌ No | ❌ No | ❌ No | Implement emoji reaction role dispatcher |
| **Community** | `/vanityrole add\|remove\|list` | ❌ No | ❌ No | ❌ No | Implement custom status scanner |
| **Community** | `/starboard setup\|disable\|view` | ⚠️ Partial | ✅ Yes | ✅ Yes | Add setup/disable commands |
| **Community** | `/clownboard setup\|disable\|view` | ❌ No | ❌ No | ❌ No | Implement hall-of-shame reaction board |
| **Community** | `/counter setup\|disable\|view\|reset` | ❌ No | ❌ No | ❌ No | Implement counting channel engine |
| **Community** | `/autoresponder add\|remove\|list` | ❌ No | ❌ No | ❌ No | Implement keyword auto-replies |
| **Community** | `/bumper setup\|disable\|view\|bump` | ❌ No | ❌ No | ❌ No | Implement bump reminders |
| **Community** | `/social add\|remove\|list` | ❌ No | ❌ No | ❌ No | Implement YouTube/Twitch/Reddit alerts |
| **Community** | `/boosterrole create\|color\|name\|icon` | ❌ No | ❌ No | ❌ No | Implement custom booster role builder |
| **Utility** | `/afk` | ❌ No | ❌ No | ❌ No | Implement AFK status & mention notifier |
| **Utility** | `/suggest` / `/report` | ❌ No | ❌ No | ❌ No | Implement suggestion & report workflows |
| **Utility** | `/announce` / `/embed` | ❌ No | ❌ No | ❌ No | Implement rich announcement & embed builders |
| **Utility** | `/serverassets` / `/servericon` | ❌ No | ❌ No | ❌ No | Implement asset viewer |
| **Utility** | `/roles` / `/emojis` / `/boosters` | ❌ No | ❌ No | ❌ No | Implement guild breakdown viewers |
| **Utility** | `/messages` | ❌ No | ❌ No | ❌ No | Implement user message counter command |
| **Utility** | `/snipe` / `/editsnipe` | ❌ No | ❌ No | ❌ No | Implement recent deleted/edited message memory |
| **Utility** | `/remind set\|list\|remove` | ⚠️ Partial | ✅ Yes | ✅ Yes | Standardize `/remind` syntax |
| **Utility** | `/crypto` / `/color` / `/weather` | ❌ No | ❌ No | ❌ No | Implement financial, color, weather tools |
| **Utility** | `/translate` / `/define` / `/wiki` | ❌ No | ❌ No | ❌ No | Implement language & dictionary tools |
| **Utility** | `/github user\|repo\|search` | ❌ No | ❌ No | ❌ No | Implement GitHub search API tool |
| **Utility** | `/steal` / `/emojiadd` / `/emojidelete` | ❌ No | ❌ No | ❌ No | Implement emoji upload & steal tools |
| **Economy** | `/economy balance\|daily\|pay` | ✅ Yes | ✅ Yes | ✅ Yes | Standardize subcommands |
| **Economy** | `/economy beg\|gamble` | ❌ No | ❌ No | ❌ No | Implement begging & casino gamble |
| **Fun & Games** | `/rp <action> [user]` | ❌ No | ❌ No | ❌ No | Implement 20+ nekos.best roleplay actions |
| **Fun & Games** | `/image <effect>` | ❌ No | ❌ No | ❌ No | Implement image manipulation effects |
| **Fun & Games** | `/tictactoe` / `/trivia` | ❌ No | ❌ No | ❌ No | Implement interactive games with buttons |
| **Fun & Games** | `/urban` / `/meme` / `/fun` | ❌ No | ❌ No | ❌ No | Implement urban dictionary, memes, 8ball |
| **Fun & Games** | `/fortnite stats\|map\|shop` | ❌ No | ❌ No | ❌ No | Implement Fortnite API client |
| **Admin & Setup** | `/setup-mod modlog\|suggestions` | ❌ No | ❌ No | ❌ No | Mod channel routing setup |
| **Admin & Setup** | `/prefix set\|view` | ❌ No | ❌ No | ❌ No | Custom guild prefix |
| **Admin & Setup** | `/prefix noprefix-grant\|revoke` | ❌ No | ❌ No | ❌ No | User no-prefix management |
| **Templates** | `/template save\|load\|view\|list` | ❌ No | ❌ No | ❌ No | Server layout clone & restore engine |
