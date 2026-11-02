import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type Client,
  type User,
} from 'discord.js';

export interface HelpCategoryMeta {
  readonly id: string;
  readonly name: string;
  readonly emoji: string;
  readonly description: string;
  readonly isMain: boolean;
  readonly commands: readonly { readonly name: string; readonly desc: string }[];
}

export const HELP_CATEGORIES: readonly HelpCategoryMeta[] = [
  {
    id: 'music',
    name: 'Music & Audio',
    emoji: '🎵',
    description: 'High-performance audio playback with native DSP and multi-source streaming.',
    isMain: true,
    commands: [
      { name: '/play [input]', desc: 'Stream from YouTube, Spotify, or Apple Music' },
      { name: '/pause', desc: 'Pause active voice track playback' },
      { name: '/resume', desc: 'Resume paused track playback' },
      { name: '/skip', desc: 'Advance to next track in queue' },
      { name: '/stop', desc: 'Clear queue and halt voice playback' },
      { name: '/queue [page]', desc: 'Display paginated server track queue' },
      { name: '/nowplaying', desc: 'Show live track progress bar & audio metadata' },
      { name: '/volume [0-200]', desc: 'Dynamically adjust voice stream gain' },
      { name: '/seek [time]', desc: 'Jump to specific track timestamp (e.g. 1:30)' },
      { name: '/loop [off|track|queue]', desc: 'Configure playback repetition mode' },
      { name: '/shuffle', desc: 'Randomize waiting queue order' },
      { name: '/clear', desc: 'Empty waiting tracks from queue' },
      { name: '/filter [preset]', desc: 'Apply DSP audio equalization preset' },
      { name: '/autoplay', desc: 'Toggle smart song recommendation engine' },
      { name: '/join', desc: 'Connect bot to your current voice channel' },
    ],
  },
  {
    id: 'moderation',
    name: 'Moderation & Discipline',
    emoji: '🛡️',
    description: 'Enterprise-grade member enforcement and infraction tracking.',
    isMain: true,
    commands: [
      { name: '/ban [user] [reason]', desc: 'Permanently ban member with case record' },
      { name: '/unban [userId]', desc: 'Revoke guild ban by user ID' },
      { name: '/kick [user]', desc: 'Remove member from server' },
      { name: '/timeout [user] [duration]', desc: 'Apply Discord native communication timeout' },
      { name: '/mute & /unmute', desc: 'Server voice mute control' },
      { name: '/softban [user]', desc: 'Ban and immediately unban to scrub messages' },
      { name: '/warn [user] [reason]', desc: 'Record formal disciplinary warning' },
      { name: '/cases [user]', desc: 'View infraction history and case IDs' },
      { name: '/purge [amount]', desc: 'Bulk delete messages from current channel' },
      { name: '/slowmode [seconds]', desc: 'Set channel chat rate limiting' },
      { name: '/lock & /unlock', desc: 'Toggle channel send message permissions' },
      { name: '/lockall', desc: 'Initiate emergency server-wide channel lockdown' },
      { name: '/hide & /vclock', desc: 'Hide text channel or lock voice channel' },
      { name: '/role [user] [role]', desc: 'Assign or remove server role' },
      { name: '/nick [user] [name]', desc: 'Change member server nickname' },
      { name: '/jail [user]', desc: 'Isolate member in disciplinary jail channel' },
      { name: '/move [user] [channel]', desc: 'Relocate member between voice channels' },
    ],
  },
  {
    id: 'security',
    name: 'Security & Defense',
    emoji: '🔒',
    description: 'Autonomous threat defense, anti-nuke thresholds, and raid filters.',
    isMain: true,
    commands: [
      { name: '/antinuke [enable|disable|settings]', desc: 'Anti-nuke defense against rogue admins' },
      { name: '/antiraid [enable|disable|lockdown]', desc: 'Anti-raid flood detection and gate' },
      { name: '/automod [rule|action|view]', desc: 'Regex, link, and Discord invite auto-censoring' },
    ],
  },
  {
    id: 'tickets',
    name: 'Support & Tickets',
    emoji: '🎫',
    description: 'Interactive button-based support tickets with HTML transcripts.',
    isMain: true,
    commands: [
      { name: '/ticket setup', desc: 'Configure ticket category, staff role & log channel' },
      { name: '/ticket panel', desc: 'Deploy interactive ticket creation button embed' },
      { name: '/ticket create [topic]', desc: 'Open private support ticket channel' },
      { name: '/ticket close [reason]', desc: 'Resolve and archive active ticket' },
      { name: '/ticket claim & /ticket unclaim', desc: 'Staff ticket assignment' },
      { name: '/ticket add & /ticket remove', desc: 'Manage member access to active ticket' },
      { name: '/ticket rename [name]', desc: 'Update ticket channel label' },
      { name: '/ticket list', desc: 'View list of all open guild tickets' },
      { name: '/ticket transcript', desc: 'Generate HTML chat transcript export' },
    ],
  },
  {
    id: 'leveling',
    name: 'Leveling & XP',
    emoji: '🏆',
    description: 'Activity progression system with custom rank cards and rewards.',
    isMain: true,
    commands: [
      { name: '/rank [user]', desc: 'Display graphical XP rank card and progress bar' },
      { name: '/levels', desc: 'View top ranked server chat & voice members' },
      { name: '/leaderboard [view|setup|list]', desc: 'Multi-metric leaderboard embeds' },
      { name: '/reset [all|xp|messages|voice]', desc: 'Administrative XP reset utility' },
      { name: '/setup-leveling', desc: 'Configure XP multipliers, alerts & role rewards' },
      { name: '/xp-set [user] [amount]', desc: 'Manually edit member XP balance' },
    ],
  },
  {
    id: 'voicemaster',
    name: 'VoiceMaster Channels',
    emoji: '🔊',
    description: 'Dynamic "Join to Create" temporary voice channel management suite.',
    isMain: true,
    commands: [
      { name: '/voicemaster setup', desc: 'Install Join to Create master lobby' },
      { name: '/setup-vc', desc: 'Quick voice master channel wizard' },
      { name: '/vc name [name]', desc: 'Rename your private temporary voice room' },
      { name: '/vc lock & /vc unlock', desc: 'Toggle private voice room permissions' },
      { name: '/vc hide & /vc unhide', desc: 'Toggle room visibility on channel list' },
      { name: '/vc permit & /vc reject', desc: 'Manage member room access whitelist' },
      { name: '/vc kick [user]', desc: 'Evict member from your temporary voice room' },
      { name: '/vc limit [count]', desc: 'Set maximum user capacity for room' },
      { name: '/vc transfer [user]', desc: 'Transfer room ownership to another member' },
    ],
  },
  {
    id: 'giveaways',
    name: 'Giveaways & Drops',
    emoji: '🎁',
    description: 'Automated timed giveaways with interactive entry buttons & rerolls.',
    isMain: true,
    commands: [
      { name: '/gstart [duration] [winners] [prize]', desc: 'Launch interactive giveaway embed' },
      { name: '/gend [messageId]', desc: 'Conclude active giveaway immediately' },
      { name: '/greroll [messageId]', desc: 'Reroll fresh random winner(s)' },
      { name: '/glist', desc: 'View list of active server giveaways' },
    ],
  },
  {
    id: 'community',
    name: 'Community Suite',
    emoji: '👥',
    description: 'Member engagement tools, vanity roles, counters, and auto-responders.',
    isMain: false,
    commands: [
      { name: '/autorole', desc: 'Configure automatic roles given on member join' },
      { name: '/reactionrole', desc: 'Deploy clickable role selection menus' },
      { name: '/vanityrole', desc: 'Reward members with role for vanity URL in status' },
      { name: '/clownboard', desc: 'Highlight humorous server messages by reactions' },
      { name: '/counter', desc: 'Create live server statistic voice channels' },
      { name: '/autoresponder', desc: 'Create automated keyword trigger responses' },
      { name: '/invites', desc: 'Track invite links and member recruitment stats' },
      { name: '/timer', desc: 'Set custom countdown timers in channel' },
      { name: '/bumper', desc: 'Configure periodic server bump reminders' },
      { name: '/social', desc: 'Broadcast Twitch, YouTube & X stream feeds' },
      { name: '/boosterrole', desc: 'Configure custom perks for server boosters' },
    ],
  },
  {
    id: 'economy',
    name: 'Virtual Economy',
    emoji: '💰',
    description: 'Virtual currency ecosystem with jobs, banking, and casino wagers.',
    isMain: false,
    commands: [
      { name: '/balance [user]', desc: 'View wallet and bank coin balances' },
      { name: '/daily', desc: 'Claim daily 24-hour currency bonus' },
      { name: '/work', desc: 'Complete work shift for wage payout' },
      { name: '/beg', desc: 'Solicit random currency coins' },
      { name: '/gamble [amount]', desc: 'Wager coins against house odds' },
      { name: '/pay [user] [amount]', desc: 'Transfer funds to another server member' },
      { name: '/deposit [amount]', desc: 'Store cash coins in secure bank account' },
      { name: '/withdraw [amount]', desc: 'Retrieve funds from bank account' },
      { name: '/rich', desc: 'Display guild economic wealth leaderboard' },
    ],
  },
  {
    id: 'fun',
    name: 'Fun & Entertainment',
    emoji: '🎮',
    description: 'Interactive mini-games, anime roleplay, memes, and trivia.',
    isMain: false,
    commands: [
      { name: '/rp [action] [user]', desc: 'Expressive anime roleplay interactions' },
      { name: '/image [prompt]', desc: 'Generate AI visual art from text prompt' },
      { name: '/tictactoe [user]', desc: 'Play 3x3 Tic-Tac-Toe against another member' },
      { name: '/trivia [category]', desc: 'Launch multi-choice trivia competition' },
      { name: '/urban [slang]', desc: 'Search Urban Dictionary definitions' },
      { name: '/fun [8ball|coinflip|roll|choose]', desc: 'Random chance and decision utilities' },
      { name: '/meme', desc: 'Fetch top trending internet memes' },
      { name: '/fortnite [player]', desc: 'Inspect player battle royale statistics' },
    ],
  },
  {
    id: 'utility',
    name: 'Utility & Tools',
    emoji: '🧰',
    description: 'Server reconnaissance, GitHub user dossiers, polls, and reminders.',
    isMain: false,
    commands: [
      { name: '/userinfo [user]', desc: 'Detailed member profile, roles & permissions' },
      { name: '/serverinfo', desc: 'Complete guild architecture and feature breakdown' },
      { name: '/avatar [user]', desc: 'High-resolution member avatar viewer' },
      { name: '/poll [question]', desc: 'Launch interactive community voting poll' },
      { name: '/remindme [time] [task]', desc: 'Set personal reminder notifications' },
      { name: '/afk [reason]', desc: 'Set automated away-from-keyboard notice' },
      { name: '/github [username]', desc: 'Inspect realtime GitHub user profile dossier' },
      { name: '/snipe & /editsnipe', desc: 'Recover recently deleted or edited messages' },
      { name: '/crypto [coin]', desc: 'Fetch live cryptocurrency valuations' },
      { name: '/weather [city]', desc: 'Realtime global meteorological forecasts' },
      { name: '/translate [text] [lang]', desc: 'Multilingual text translation engine' },
      { name: '/define [word]', desc: 'English dictionary word definitions' },
      { name: '/wiki [query]', desc: 'Search Wikipedia encyclopedia summaries' },
      { name: '/serverassets & /servericon', desc: 'Export guild icons, banners & splashes' },
      { name: '/roles & /emojis & /boosters', desc: 'Guild asset listings & member directories' },
      { name: '/info', desc: 'Display bot engine platform specifications' },
    ],
  },
];

export function buildHelpOverviewEmbed(
  user?: User | null,
  client?: Client | null,
): EmbedBuilder {
  const botAvatar = client?.user?.displayAvatarURL?.() ?? undefined;
  const userAvatar = user?.displayAvatarURL?.() ?? undefined;
  const username = user?.username ?? 'Commander';

  const embed = new EmbedBuilder()
    .setAuthor({
      name: `${username} • RIFFLY Directory`,
      ...(userAvatar ? { iconURL: userAvatar } : {}),
    })
    .setTitle('❖ RIFFLY SECURITY & OPERATIONS MATRIX')
    .setColor(0x5865f2)
    .setDescription(
      '`Commands:` **100** `Registered` 〢 `Modules:` **15** `Active`\n' +
        '`Protection:` **Enterprise Grade** 〢 `Infrastructure:` **High Availability**\n\n' +
        'Browse modules from the menu — or tap a filter button below.',
    )
    .addFields(
      {
        name: 'Core Systems',
        value:
          '⬡ **Music & Audio**\n' +
          '⤹ **Auto Moderation**\n' +
          '† **Moderation**\n' +
          '◫ **Ticket Support**\n' +
          '✦ **Giveaways**\n' +
          '△ **Leveling**\n' +
          '♕ **Leaderboard**\n' +
          '◎ **Voice Channels**',
        inline: true,
      },
      {
        name: 'Auxiliary Suite',
        value:
          '⊘ **AntiRaid & AntiNuke**\n' +
          '⊡ **Auto Roles**\n' +
          '𝌆 **Logging & Audit**\n' +
          '▲ **Server Stats**\n' +
          '🕒 **Polls & Timers**\n' +
          '❖ **Virtual Economy**\n' +
          '◇ **Information & Utility**',
        inline: true,
      },
    )
    .setFooter({
      text: 'Powered by Riffly HQ • Realtime Defense & Audio Systems',
      ...(botAvatar ? { iconURL: botAvatar } : {}),
    })
    .setTimestamp();

  if (botAvatar) {
    embed.setThumbnail(botAvatar);
  }

  return embed;
}

export function buildHelpMainEmbed(
  user?: User | null,
  client?: Client | null,
): EmbedBuilder {
  const botAvatar = client?.user?.displayAvatarURL?.() ?? undefined;
  const userAvatar = user?.displayAvatarURL?.() ?? undefined;
  const username = user?.username ?? 'Commander';
  const mainCats = HELP_CATEGORIES.filter((c) => c.isMain);

  const embed = new EmbedBuilder()
    .setAuthor({
      name: `${username} • Core Systems Matrix`,
      ...(userAvatar ? { iconURL: userAvatar } : {}),
    })
    .setTitle('❖ RIFFLY CORE SYSTEMS DIRECTORY')
    .setColor(0x5865f2)
    .setDescription(
      'Primary core operations powering audio transmission, moderation, autonomous security, tickets, and temporary voice rooms.\n\n' +
        '*Select any module from the dropdown below for granular command syntaxes.*',
    )
    .setFooter({
      text: 'Powered by Riffly HQ • Core Operations',
      ...(botAvatar ? { iconURL: botAvatar } : {}),
    })
    .setTimestamp();

  if (botAvatar) {
    embed.setThumbnail(botAvatar);
  }

  for (const cat of mainCats) {
    const list = cat.commands.slice(0, 4).map((c) => `\`${c.name.split(' ')[0]}\``).join(', ');
    const count = cat.commands.length;
    embed.addFields({
      name: `${cat.emoji} ${cat.name} (${count} Commands)`,
      value: `${cat.description}\n**Popular:** ${list}...`,
      inline: false,
    });
  }

  return embed;
}

export function buildHelpExtraEmbed(
  user?: User | null,
  client?: Client | null,
): EmbedBuilder {
  const botAvatar = client?.user?.displayAvatarURL?.() ?? undefined;
  const userAvatar = user?.displayAvatarURL?.() ?? undefined;
  const username = user?.username ?? 'Commander';
  const extraCats = HELP_CATEGORIES.filter((c) => !c.isMain);

  const embed = new EmbedBuilder()
    .setAuthor({
      name: `${username} • Auxiliary Suite Matrix`,
      ...(userAvatar ? { iconURL: userAvatar } : {}),
    })
    .setTitle('❖ RIFFLY AUXILIARY SUITE DIRECTORY')
    .setColor(0x5865f2)
    .setDescription(
      'Auxiliary suite providing community automation, virtual economy, interactive gaming, and server utility tools.\n\n' +
        '*Select any module from the dropdown below for granular command syntaxes.*',
    )
    .setFooter({
      text: 'Powered by Riffly HQ • Auxiliary Operations',
      ...(botAvatar ? { iconURL: botAvatar } : {}),
    })
    .setTimestamp();

  if (botAvatar) {
    embed.setThumbnail(botAvatar);
  }

  for (const cat of extraCats) {
    const list = cat.commands.slice(0, 4).map((c) => `\`${c.name.split(' ')[0]}\``).join(', ');
    const count = cat.commands.length;
    embed.addFields({
      name: `${cat.emoji} ${cat.name} (${count} Commands)`,
      value: `${cat.description}\n**Popular:** ${list}...`,
      inline: false,
    });
  }

  return embed;
}

export function buildHelpCategoryEmbed(
  user?: User | null,
  client?: Client | null,
  categoryId: string = 'music',
): EmbedBuilder {
  const botAvatar = client?.user?.displayAvatarURL?.() ?? undefined;
  const userAvatar = user?.displayAvatarURL?.() ?? undefined;
  const username = user?.username ?? 'Commander';
  const category = HELP_CATEGORIES.find((c) => c.id === categoryId) ?? HELP_CATEGORIES[0]!;

  const commandLines = category.commands
    .map((c) => `• **${c.name}**\n  ↳ *${c.desc}*`)
    .join('\n\n');

  const embed = new EmbedBuilder()
    .setAuthor({
      name: `${username} • ${category.name}`,
      ...(userAvatar ? { iconURL: userAvatar } : {}),
    })
    .setTitle(`${category.emoji} ${category.name.toUpperCase()} MATRIX`)
    .setColor(0x5865f2)
    .setDescription(
      `**Module Status:** \`Operational (v2.0.0)\`\n` +
        `**Command Count:** \`${category.commands.length} Commands\`\n\n` +
        `${category.description}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `### Available Commands\n\n` +
        `${commandLines}\n\n` +
        `*Tip: Use slash command autocomplete in chat to view required and optional flags.*`,
    )
    .setFooter({
      text: 'Powered by Riffly HQ • Realtime Defense & Audio Systems',
      ...(botAvatar ? { iconURL: botAvatar } : {}),
    })
    .setTimestamp();

  if (botAvatar) {
    embed.setThumbnail(botAvatar);
  }

  return embed;
}

export function buildHelpActionRows(
  activeTab: 'overview' | 'main' | 'extra' | string = 'overview',
  disabled = false,
): ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] {
  const isMainTab = activeTab === 'main';
  const isExtraTab = activeTab === 'extra';
  const isOverviewTab = activeTab === 'overview';

  const buttonsRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('riffly_help_main')
      .setLabel('Main Module')
      .setStyle(isMainTab ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId('riffly_help_extra')
      .setLabel('Extra Module')
      .setStyle(isExtraTab ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId('riffly_help_overview')
      .setLabel('Overview')
      .setStyle(isOverviewTab ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(disabled),
  );

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('riffly_help_select')
    .setPlaceholder('Select a module from the menu below to explore commands')
    .setDisabled(disabled)
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('Overview')
        .setValue('overview')
        .setDescription('Return to the Operations Matrix overview')
        .setEmoji('🏠')
        .setDefault(activeTab === 'overview'),
    );

  for (const cat of HELP_CATEGORIES) {
    selectMenu.addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel(cat.name)
        .setValue(cat.id)
        .setDescription(`${cat.commands.length} commands • ${cat.description.slice(0, 50)}...`)
        .setEmoji(cat.emoji)
        .setDefault(activeTab === cat.id),
    );
  }

  const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  return [buttonsRow, selectRow];
}
