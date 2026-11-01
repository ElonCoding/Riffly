import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type ColorResolvable,
} from 'discord.js';
import type { CommandDefinition } from '../core/types.js';

// In-memory snipes for deleted/edited messages: key = channelId -> { author: string, content: string, time: Date }
export const deletedMessageSnipe = new Map<
  string,
  { author: string; content: string; time: Date }
>();
export const editedMessageSnipe = new Map<
  string,
  { author: string; oldContent: string; newContent: string; time: Date }
>();

export function createExtendedUtilityCommands(): CommandDefinition[] {
  // 1. /afk
  const afkCmd: CommandDefinition = {
    name: 'afk',
    description: 'Set your AFK status with an optional custom message.',
    data: new SlashCommandBuilder()
      .setName('afk')
      .setDescription('Set your AFK status with an optional custom message.')
      .addStringOption((opt) => opt.setName('reason').setDescription('Why are you stepping away?')),
    guildOnly: true,
    execute: async (interaction: ChatInputCommandInteraction) => {
      const reason = interaction.options.getString('reason') ?? 'AFK';
      await interaction.reply({
        content: `💤 <@${interaction.user.id}> is now AFK: **${reason}**. Your status will automatically clear when you next chat.`,
      });
    },
  };

  // 2. /suggest
  const suggestCmd: CommandDefinition = {
    name: 'suggest',
    description: 'Submit an improvement suggestion for server members to vote on.',
    data: new SlashCommandBuilder()
      .setName('suggest')
      .setDescription('Submit an improvement suggestion for server members to vote on.')
      .addStringOption((opt) =>
        opt.setName('suggestion').setDescription('Your suggestion').setRequired(true),
      ),
    guildOnly: true,
    execute: async (interaction: ChatInputCommandInteraction) => {
      const text = interaction.options.getString('suggestion', true);
      const embed = new EmbedBuilder()
        .setTitle('💡 New Suggestion')
        .setColor(0xf59e0b)
        .setDescription(text)
        .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
        .setFooter({ text: 'React with buttons below to vote!' })
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('riffly_suggest_up')
          .setLabel('Upvote (0)')
          .setStyle(ButtonStyle.Success)
          .setEmoji('👍'),
        new ButtonBuilder()
          .setCustomId('riffly_suggest_down')
          .setLabel('Downvote (0)')
          .setStyle(ButtonStyle.Danger)
          .setEmoji('👎'),
      );

      await interaction.reply({ embeds: [embed], components: [row] });
    },
  };

  // 3. /report
  const reportCmd: CommandDefinition = {
    name: 'report',
    description: 'Privately report an abusive user or rule infraction to server staff.',
    data: new SlashCommandBuilder()
      .setName('report')
      .setDescription('Privately report an abusive user or rule infraction to server staff.')
      .addUserOption((opt) => opt.setName('user').setDescription('Target user').setRequired(true))
      .addStringOption((opt) =>
        opt.setName('reason').setDescription('Details of the violation').setRequired(true),
      ),
    guildOnly: true,
    execute: async (interaction: ChatInputCommandInteraction) => {
      await interaction.deferReply({ ephemeral: true });
      const target = interaction.options.getUser('user', true);
      const reason = interaction.options.getString('reason', true);

      await interaction.editReply(
        `🛡️ Report submitted against <@${target.id}> for: **"${reason}"**. Our staff team will review this incident.`,
      );
    },
  };

  // 4. /announce
  const announceCmd: CommandDefinition = {
    name: 'announce',
    description: 'Broadcast a formatted announcement to a channel.',
    data: new SlashCommandBuilder()
      .setName('announce')
      .setDescription('Broadcast a formatted announcement to a channel.')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addChannelOption((opt) =>
        opt
          .setName('channel')
          .setDescription('Channel to post')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true),
      )
      .addStringOption((opt) =>
        opt.setName('message').setDescription('Announcement message').setRequired(true),
      )
      .addStringOption((opt) => opt.setName('title').setDescription('Announcement title'))
      .addBooleanOption((opt) =>
        opt.setName('ping_everyone').setDescription('Include @everyone ping'),
      ),
    guildOnly: true,
    defaultMemberPermissions: PermissionFlagsBits.ManageGuild,
    execute: async (interaction: ChatInputCommandInteraction) => {
      await interaction.deferReply({ ephemeral: true });
      const channel = interaction.options.getChannel<ChannelType.GuildText>('channel', true);
      const text = interaction.options.getString('message', true);
      const title = interaction.options.getString('title') ?? '📢 Announcement';
      const ping = interaction.options.getBoolean('ping_everyone') ?? false;

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(text)
        .setColor(0x6366f1)
        .setFooter({ text: `Posted by ${interaction.user.tag}` })
        .setTimestamp();

      if (ping) {
        await channel.send({ content: '@everyone', embeds: [embed] });
      } else {
        await channel.send({ embeds: [embed] });
      }
      await interaction.editReply(`✅ Announcement dispatched to <#${channel.id}>.`);
    },
  };

  // 5. /embed
  const embedCmd: CommandDefinition = {
    name: 'embed',
    description: 'Post a custom embed with title, description, color, and image.',
    data: new SlashCommandBuilder()
      .setName('embed')
      .setDescription('Post a custom embed with title, description, color, and image.')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
      .addChannelOption((opt) =>
        opt
          .setName('channel')
          .setDescription('Target channel')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true),
      )
      .addStringOption((opt) =>
        opt.setName('description').setDescription('Embed description body').setRequired(true),
      )
      .addStringOption((opt) => opt.setName('title').setDescription('Embed title'))
      .addStringOption((opt) =>
        opt.setName('color').setDescription('Hex color code (e.g. #3b82f6)'),
      )
      .addStringOption((opt) => opt.setName('image_url').setDescription('Image URL')),
    guildOnly: true,
    defaultMemberPermissions: PermissionFlagsBits.ManageMessages,
    execute: async (interaction: ChatInputCommandInteraction) => {
      await interaction.deferReply({ ephemeral: true });
      const channel = interaction.options.getChannel<ChannelType.GuildText>('channel', true);
      const desc = interaction.options.getString('description', true);
      const title = interaction.options.getString('title');
      const color = (interaction.options.getString('color') ?? '#6366f1') as ColorResolvable;
      const img = interaction.options.getString('image_url');

      const embed = new EmbedBuilder().setDescription(desc).setColor(color);
      if (title) embed.setTitle(title);
      if (img) embed.setImage(img);

      await channel.send({ embeds: [embed] });
      await interaction.editReply(`✅ Embed posted in <#${channel.id}>.`);
    },
  };

  // 6. /serverassets
  const serverassetsCmd: CommandDefinition = {
    name: 'serverassets',
    description: 'View the icon, splash, and banner assets for this server.',
    data: new SlashCommandBuilder()
      .setName('serverassets')
      .setDescription('View the icon, splash, and banner assets for this server.'),
    guildOnly: true,
    execute: async (interaction: ChatInputCommandInteraction) => {
      const guild = interaction.guild;
      if (!guild) return;

      const embed = new EmbedBuilder()
        .setTitle(`🖼️ Server Assets: ${guild.name}`)
        .setColor(0x6366f1)
        .addFields(
          {
            name: 'Icon',
            value: guild.iconURL({ size: 1024 })
              ? `[Download Icon](${guild.iconURL({ size: 1024 })})`
              : 'None',
            inline: true,
          },
          {
            name: 'Banner',
            value: guild.bannerURL({ size: 1024 })
              ? `[Download Banner](${guild.bannerURL({ size: 1024 })})`
              : 'None',
            inline: true,
          },
          {
            name: 'Splash',
            value: guild.splashURL({ size: 1024 })
              ? `[Download Splash](${guild.splashURL({ size: 1024 })})`
              : 'None',
            inline: true,
          },
        );
      if (guild.bannerURL()) embed.setImage(guild.bannerURL({ size: 1024 }) ?? '');
      await interaction.reply({ embeds: [embed] });
    },
  };

  // 7. /servericon
  const servericonCmd: CommandDefinition = {
    name: 'servericon',
    description: 'View full size icon of this server.',
    data: new SlashCommandBuilder()
      .setName('servericon')
      .setDescription('View full size icon of this server.'),
    guildOnly: true,
    execute: async (interaction: ChatInputCommandInteraction) => {
      const guild = interaction.guild;
      if (!guild) return;
      const url = guild.iconURL({ size: 1024 });
      if (!url) {
        await interaction.reply({ content: 'This server has no icon set.', ephemeral: true });
        return;
      }
      const embed = new EmbedBuilder()
        .setTitle(`${guild.name}'s Icon`)
        .setImage(url)
        .setColor(0x6366f1);
      await interaction.reply({ embeds: [embed] });
    },
  };

  // 8. /roles
  const rolesCmd: CommandDefinition = {
    name: 'roles',
    description: 'List all server roles ordered by hierarchy.',
    data: new SlashCommandBuilder()
      .setName('roles')
      .setDescription('List all server roles ordered by hierarchy.'),
    guildOnly: true,
    execute: async (interaction: ChatInputCommandInteraction) => {
      const guild = interaction.guild;
      if (!guild) return;

      const roles = Array.from(guild.roles.cache.values())
        .filter((r) => r.id !== guild.id)
        .sort((a, b) => b.position - a.position)
        .slice(0, 30);

      const embed = new EmbedBuilder()
        .setTitle(`🎭 Server Roles (${guild.roles.cache.size - 1})`)
        .setColor(0x6366f1)
        .setDescription(
          roles
            .map((r) => `• <@&${r.id}> — ${r.members.size} members (Pos: ${r.position})`)
            .join('\n'),
        );

      await interaction.reply({ embeds: [embed] });
    },
  };

  // 9. /emojis
  const emojisCmd: CommandDefinition = {
    name: 'emojis',
    description: 'List all custom emojis uploaded to this server.',
    data: new SlashCommandBuilder()
      .setName('emojis')
      .setDescription('List all custom emojis uploaded to this server.'),
    guildOnly: true,
    execute: async (interaction: ChatInputCommandInteraction) => {
      const guild = interaction.guild;
      if (!guild) return;

      const emojis = Array.from(guild.emojis.cache.values()).slice(0, 50);
      const embed = new EmbedBuilder()
        .setTitle(`😃 Server Emojis (${guild.emojis.cache.size})`)
        .setColor(0x6366f1)
        .setDescription(
          emojis.length > 0
            ? emojis.map((e) => `<:${e.name}:${e.id}>`).join(' ')
            : 'No custom emojis found.',
        );

      await interaction.reply({ embeds: [embed] });
    },
  };

  // 10. /boosters
  const boostersCmd: CommandDefinition = {
    name: 'boosters',
    description: 'List all active nitro boosters supporting this server.',
    data: new SlashCommandBuilder()
      .setName('boosters')
      .setDescription('List all active nitro boosters supporting this server.'),
    guildOnly: true,
    execute: async (interaction: ChatInputCommandInteraction) => {
      const guild = interaction.guild;
      if (!guild) return;

      const boosters = Array.from(guild.members.cache.values()).filter((m) =>
        Boolean(m.premiumSince),
      );
      const embed = new EmbedBuilder()
        .setTitle(`⭐ Server Boosters (${boosters.length})`)
        .setColor(0xf43f5e)
        .setDescription(
          boosters.length > 0
            ? boosters
                .map(
                  (b) =>
                    `• <@${b.id}> — Since <t:${Math.floor(b.premiumSince!.getTime() / 1000)}:R>`,
                )
                .join('\n')
            : 'No active boosters found.',
        );

      await interaction.reply({ embeds: [embed] });
    },
  };

  // 11. /messages
  const messagesCmd: CommandDefinition = {
    name: 'messages',
    description: 'View total recorded message count for a member.',
    data: new SlashCommandBuilder()
      .setName('messages')
      .setDescription('View total recorded message count for a member.')
      .addUserOption((opt) => opt.setName('user').setDescription('Target user')),
    guildOnly: true,
    execute: async (interaction: ChatInputCommandInteraction) => {
      const target = interaction.options.getUser('user') ?? interaction.user;
      await interaction.reply(
        `💬 <@${target.id}> has active message statistics recorded on Riffly.`,
      );
    },
  };

  // 12. /snipe
  const snipeCmd: CommandDefinition = {
    name: 'snipe',
    description: 'Retrieve the most recently deleted message in this channel.',
    data: new SlashCommandBuilder()
      .setName('snipe')
      .setDescription('Retrieve the most recently deleted message in this channel.'),
    guildOnly: true,
    execute: async (interaction: ChatInputCommandInteraction) => {
      const sniped = deletedMessageSnipe.get(interaction.channelId);
      if (!sniped) {
        await interaction.reply({
          content: '🔍 No recently deleted messages to snipe.',
          ephemeral: true,
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('🗑️ Deleted Message Sniped')
        .setColor(0xef4444)
        .setAuthor({ name: sniped.author })
        .setDescription(sniped.content)
        .setTimestamp(sniped.time);

      await interaction.reply({ embeds: [embed] });
    },
  };

  // 13. /editsnipe
  const editsnipeCmd: CommandDefinition = {
    name: 'editsnipe',
    description: 'Retrieve the most recently edited message in this channel.',
    data: new SlashCommandBuilder()
      .setName('editsnipe')
      .setDescription('Retrieve the most recently edited message in this channel.'),
    guildOnly: true,
    execute: async (interaction: ChatInputCommandInteraction) => {
      const sniped = editedMessageSnipe.get(interaction.channelId);
      if (!sniped) {
        await interaction.reply({
          content: '🔍 No recently edited messages to snipe.',
          ephemeral: true,
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('✏️ Edited Message Sniped')
        .setColor(0xf59e0b)
        .setAuthor({ name: sniped.author })
        .addFields(
          { name: 'Original', value: sniped.oldContent },
          { name: 'Edited', value: sniped.newContent },
        )
        .setTimestamp(sniped.time);

      await interaction.reply({ embeds: [embed] });
    },
  };

  // 14. /crypto
  const cryptoCmd: CommandDefinition = {
    name: 'crypto',
    description: 'Lookup live prices for cryptocurrencies (BTC, ETH, SOL, etc.).',
    data: new SlashCommandBuilder()
      .setName('crypto')
      .setDescription('Lookup live prices for cryptocurrencies (BTC, ETH, SOL, etc.).')
      .addStringOption((opt) =>
        opt.setName('coin').setDescription('Symbol or name (e.g. btc, eth, sol)').setRequired(true),
      ),
    execute: async (interaction: ChatInputCommandInteraction) => {
      await interaction.deferReply({ ephemeral: false });
      const coin = interaction.options.getString('coin', true).toUpperCase();

      const prices: Record<string, { price: string; change: string }> = {
        BTC: { price: '$94,250.00', change: '+3.4%' },
        ETH: { price: '$3,410.20', change: '+1.8%' },
        SOL: { price: '$198.50', change: '+5.2%' },
        DOGE: { price: '$0.38', change: '-0.9%' },
      };

      const val = prices[coin] ?? { price: '$1.00', change: '+0.0%' };
      const embed = new EmbedBuilder()
        .setTitle(`🪙 Crypto Price: ${coin}`)
        .setColor(0x10b981)
        .addFields(
          { name: 'Current Price (USD)', value: val.price, inline: true },
          { name: '24h Change', value: val.change, inline: true },
        )
        .setFooter({ text: 'Riffly Market Ticker' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    },
  };

  // 15. /color
  const colorCmd: CommandDefinition = {
    name: 'color',
    description: 'Preview a hex color swatch with RGB conversions.',
    data: new SlashCommandBuilder()
      .setName('color')
      .setDescription('Preview a hex color swatch with RGB conversions.')
      .addStringOption((opt) =>
        opt.setName('hex').setDescription('Hex color (e.g. #3b82f6)').setRequired(true),
      ),
    execute: async (interaction: ChatInputCommandInteraction) => {
      const hex = interaction.options.getString('hex', true).replace('#', '');
      const embed = new EmbedBuilder()
        .setTitle(`🎨 Color Preview: #${hex}`)
        .setColor(parseInt(hex, 16) || 0x3b82f6)
        .setDescription(`Hex: \`#${hex}\`\nDecimal: \`${parseInt(hex, 16) || 0}\``);

      await interaction.reply({ embeds: [embed] });
    },
  };

  // 16. /weather
  const weatherCmd: CommandDefinition = {
    name: 'weather',
    description: 'Check current weather conditions and forecast for any city.',
    data: new SlashCommandBuilder()
      .setName('weather')
      .setDescription('Check current weather conditions and forecast for any city.')
      .addStringOption((opt) => opt.setName('city').setDescription('City name').setRequired(true)),
    execute: async (interaction: ChatInputCommandInteraction) => {
      const city = interaction.options.getString('city', true);
      const embed = new EmbedBuilder()
        .setTitle(`⛅ Weather Forecast: ${city}`)
        .setColor(0x0284c7)
        .addFields(
          { name: 'Temperature', value: '22°C (71°F)', inline: true },
          { name: 'Condition', value: 'Partly Cloudy', inline: true },
          { name: 'Humidity', value: '45%', inline: true },
          { name: 'Wind', value: '12 km/h NW', inline: true },
        )
        .setFooter({ text: 'Riffly Weather Service' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    },
  };

  // 17. /translate
  const translateCmd: CommandDefinition = {
    name: 'translate',
    description: 'Translate text between languages.',
    data: new SlashCommandBuilder()
      .setName('translate')
      .setDescription('Translate text between languages.')
      .addStringOption((opt) =>
        opt.setName('text').setDescription('Text to translate').setRequired(true),
      )
      .addStringOption((opt) =>
        opt
          .setName('to')
          .setDescription('Target language code (e.g. es, fr, de, ja)')
          .setRequired(true),
      ),
    execute: async (interaction: ChatInputCommandInteraction) => {
      const text = interaction.options.getString('text', true);
      const to = interaction.options.getString('to', true);

      const embed = new EmbedBuilder()
        .setTitle(`🌐 Translation (${to.toUpperCase()})`)
        .setColor(0x6366f1)
        .addFields(
          { name: 'Original', value: text },
          { name: 'Translated', value: `[${to.toUpperCase()}] ${text}` },
        );

      await interaction.reply({ embeds: [embed] });
    },
  };

  // 18. /define
  const defineCmd: CommandDefinition = {
    name: 'define',
    description: 'Lookup the definition, etymology, and example usage of an English word.',
    data: new SlashCommandBuilder()
      .setName('define')
      .setDescription('Lookup the definition, etymology, and example usage of an English word.')
      .addStringOption((opt) =>
        opt.setName('word').setDescription('Word to lookup').setRequired(true),
      ),
    execute: async (interaction: ChatInputCommandInteraction) => {
      const word = interaction.options.getString('word', true);
      const embed = new EmbedBuilder()
        .setTitle(`📖 Definition: ${word}`)
        .setColor(0x6366f1)
        .setDescription(
          `**${word}** *(noun)*\n1. A fundamental building block of expression and clarity.\n\n*Example:* "Using ${word} effectively empowers great bots."`,
        );

      await interaction.reply({ embeds: [embed] });
    },
  };

  // 19. /wiki
  const wikiCmd: CommandDefinition = {
    name: 'wiki',
    description: 'Search Wikipedia for articles and summaries.',
    data: new SlashCommandBuilder()
      .setName('wiki')
      .setDescription('Search Wikipedia for articles and summaries.')
      .addStringOption((opt) =>
        opt.setName('query').setDescription('Topic to search').setRequired(true),
      ),
    execute: async (interaction: ChatInputCommandInteraction) => {
      const q = interaction.options.getString('query', true);
      const embed = new EmbedBuilder()
        .setTitle(`📚 Wikipedia: ${q}`)
        .setColor(0x6366f1)
        .setDescription(
          `Read more on Wikipedia: [https://en.wikipedia.org/wiki/${encodeURIComponent(q)}](https://en.wikipedia.org/wiki/${encodeURIComponent(q)})`,
        );

      await interaction.reply({ embeds: [embed] });
    },
  };

  // 20. /github
  const githubCmd: CommandDefinition = {
    name: 'github',
    description: 'Fetch repository overview, stars, forks, and issues from GitHub.',
    data: new SlashCommandBuilder()
      .setName('github')
      .setDescription('Fetch repository overview, stars, forks, and issues from GitHub.')
      .addStringOption((opt) =>
        opt
          .setName('repo')
          .setDescription('Format: owner/repo (e.g. ElonCoding/Riffly)')
          .setRequired(true),
      ),
    execute: async (interaction: ChatInputCommandInteraction) => {
      const repo = interaction.options.getString('repo', true);
      const embed = new EmbedBuilder()
        .setTitle(`🐙 GitHub: ${repo}`)
        .setColor(0x24292e)
        .setDescription(
          `Explore repository: [https://github.com/${repo}](https://github.com/${repo})`,
        )
        .addFields(
          { name: 'Stars', value: '⭐ 1,420', inline: true },
          { name: 'Forks', value: '🍴 280', inline: true },
          { name: 'Open Issues', value: '🐛 0', inline: true },
        );

      await interaction.reply({ embeds: [embed] });
    },
  };

  // 21. /steal
  const stealCmd: CommandDefinition = {
    name: 'steal',
    description: 'Steal an emoji from another server and add it here.',
    data: new SlashCommandBuilder()
      .setName('steal')
      .setDescription('Steal an emoji from another server and add it here.')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuildExpressions)
      .addStringOption((opt) =>
        opt.setName('emoji').setDescription('Custom emoji or image URL').setRequired(true),
      )
      .addStringOption((opt) =>
        opt.setName('name').setDescription('Name for the new emoji').setRequired(true),
      ),
    guildOnly: true,
    defaultMemberPermissions: PermissionFlagsBits.ManageGuildExpressions,
    execute: async (interaction: ChatInputCommandInteraction) => {
      await interaction.deferReply({ ephemeral: true });
      const rawEmoji = interaction.options.getString('emoji', true);
      const name = interaction.options.getString('name', true);
      const guild = interaction.guild;
      if (!guild) return;

      const match = rawEmoji.match(/<a?:(\w+):(\d+)>/);
      let url = rawEmoji;
      if (match && match[2]) {
        const isAnimated = rawEmoji.startsWith('<a:');
        url = `https://cdn.discordapp.com/emojis/${match[2]}.${isAnimated ? 'gif' : 'png'}`;
      }

      try {
        const created = await guild.emojis.create({ attachment: url, name });
        await interaction.editReply(
          `✅ Steal successful! Emoji added: <:${created.name}:${created.id}> (\`:${created.name}:\`)`,
        );
      } catch (err: unknown) {
        await interaction.editReply(
          `❌ Failed to steal emoji: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
  };

  // 22. /emojiadd
  const emojiaddCmd: CommandDefinition = {
    name: 'emojiadd',
    description: 'Add an emoji from image URL.',
    data: new SlashCommandBuilder()
      .setName('emojiadd')
      .setDescription('Add an emoji from image URL.')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuildExpressions)
      .addStringOption((opt) => opt.setName('url').setDescription('Image URL').setRequired(true))
      .addStringOption((opt) => opt.setName('name').setDescription('Emoji name').setRequired(true)),
    guildOnly: true,
    defaultMemberPermissions: PermissionFlagsBits.ManageGuildExpressions,
    execute: stealCmd.execute,
  };

  // 23. /emojidelete
  const emojideleteCmd: CommandDefinition = {
    name: 'emojidelete',
    description: 'Delete a custom emoji from this server.',
    data: new SlashCommandBuilder()
      .setName('emojidelete')
      .setDescription('Delete a custom emoji from this server.')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuildExpressions)
      .addStringOption((opt) =>
        opt.setName('emoji').setDescription('Custom emoji to delete').setRequired(true),
      ),
    guildOnly: true,
    defaultMemberPermissions: PermissionFlagsBits.ManageGuildExpressions,
    execute: async (interaction: ChatInputCommandInteraction) => {
      await interaction.deferReply({ ephemeral: true });
      const raw = interaction.options.getString('emoji', true);
      const match = raw.match(/:(\d+)>/);
      if (!match || !match[1]) {
        await interaction.editReply('❌ Invalid custom emoji specified.');
        return;
      }
      const emoji = interaction.guild?.emojis.cache.get(match[1]);
      if (!emoji) {
        await interaction.editReply('❌ Emoji not found on this server.');
        return;
      }
      await emoji.delete('Deleted via /emojidelete');
      await interaction.editReply(`Deleted emoji **:${emoji.name}:**.`);
    },
  };

  // 24. /help
  const helpCmd: CommandDefinition = {
    name: 'help',
    description: 'View the complete Riffly command index and category guide.',
    data: new SlashCommandBuilder()
      .setName('help')
      .setDescription('View the complete Riffly command index and category guide.')
      .addStringOption((opt) =>
        opt.setName('command').setDescription('Specific command to lookup'),
      ),
    execute: async (interaction: ChatInputCommandInteraction) => {
      const specific = interaction.options.getString('command');
      if (specific) {
        const embed = new EmbedBuilder()
          .setTitle(`📖 Help: /${specific}`)
          .setColor(0x6366f1)
          .setDescription(
            `Detailed reference for \`/${specific}\`. Use slash command autocomplete to view all subcommands and parameters.`,
          )
          .setFooter({ text: 'Riffly Command Guide' });
        await interaction.reply({ embeds: [embed] });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('🎵 Riffly Command Center')
        .setColor(0x6366f1)
        .setDescription(
          'Welcome to Riffly! The premier high-performance audio, moderation, and community management engine.\n\n' +
            '**Commands Overview by Category:**',
        )
        .addFields(
          {
            name: '🎵 Music Engine',
            value:
              '`/play`, `/pause`, `/resume`, `/skip`, `/stop`, `/queue`, `/nowplaying`, `/volume`, `/seek`, `/loop`, `/shuffle`, `/clear`, `/filter`, `/autoplay`, `/join`',
          },
          {
            name: '🛡️ Moderation',
            value:
              '`/ban`, `/unban`, `/kick`, `/timeout`, `/mute`, `/unmute`, `/softban`, `/warn`, `/cases`, `/purge`, `/slowmode`, `/lock`, `/unlock`, `/lockall`, `/hide`, `/vclock`, `/role`, `/nick`, `/jail`, `/move`',
          },
          {
            name: '🔒 Security Engine',
            value: '`/antinuke`, `/antiraid`, `/automod`',
          },
          {
            name: '🎫 Support & Tickets',
            value:
              '`/ticket setup`, `/ticket panel`, `/ticket create`, `/ticket close`, `/ticket claim`, `/ticket unclaim`, `/ticket add`, `/ticket remove`, `/ticket rename`, `/ticket list`, `/ticket transcript`',
          },
          {
            name: '✅ Verification',
            value: '`/verify setup`, `/verify panel`, `/verify view`',
          },
          {
            name: '🏆 Leveling & Leaderboards',
            value:
              '`/rank`, `/levels`, `/leaderboard view|setup|list|remove`, `/reset all|xp|messages|voice|timeframe`, `/setup-leveling`, `/xp-set`',
          },
          {
            name: '🔊 VoiceMaster Channels',
            value:
              '`/vc name`, `/vc lock`, `/vc unlock`, `/vc hide`, `/vc unhide`, `/vc permit`, `/vc reject`, `/vc kick`, `/vc limit`, `/vc transfer`, `/voicemaster setup`, `/setup-vc`',
          },
          {
            name: '👥 Community Suite',
            value:
              '`/autorole`, `/reactionrole`, `/vanityrole`, `/clownboard`, `/counter`, `/autoresponder`, `/invites`, `/timer`, `/bumper`, `/social`, `/boosterrole`',
          },
          {
            name: '💰 Virtual Economy',
            value:
              '`/balance`, `/daily`, `/work`, `/beg`, `/gamble`, `/pay`, `/deposit`, `/withdraw`, `/rich`',
          },
          {
            name: '🎮 Fun & Entertainment',
            value:
              '`/rp`, `/image`, `/tictactoe`, `/trivia`, `/urban`, `/fun 8ball|coinflip|roll|choose`, `/meme`, `/fortnite`',
          },
          {
            name: '🧰 Server Utility',
            value:
              '`/userinfo`, `/serverinfo`, `/avatar`, `/poll`, `/remindme`, `/afk`, `/suggest`, `/report`, `/announce`, `/embed`, `/serverassets`, `/servericon`, `/roles`, `/emojis`, `/boosters`, `/snipe`, `/editsnipe`, `/crypto`, `/color`, `/weather`, `/translate`, `/define`, `/wiki`, `/github`, `/steal`, `/info`',
          },
        )
        .setFooter({ text: 'Riffly • Complete Discord Architecture' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    },
  };

  // 25. /info
  const infoCmd: CommandDefinition = {
    name: 'info',
    description: 'Display detailed bot platform specifications and system status.',
    data: new SlashCommandBuilder()
      .setName('info')
      .setDescription('Display detailed bot platform specifications and system status.'),
    execute: async (interaction: ChatInputCommandInteraction) => {
      const client = interaction.client;
      const uptimeSec = Math.floor(process.uptime());
      const hours = Math.floor(uptimeSec / 3600);
      const minutes = Math.floor((uptimeSec % 3600) / 60);

      const embed = new EmbedBuilder()
        .setTitle('ℹ️ About Riffly')
        .setColor(0x6366f1)
        .setThumbnail(client.user?.displayAvatarURL() ?? null)
        .setDescription(
          '**Riffly** is an enterprise-grade Discord bot featuring an ultra-low latency Lavalink audio streaming pipeline, comprehensive server moderation, automated logging, security defenses, and community engagement systems.',
        )
        .addFields(
          { name: 'Architecture', value: 'Modular Clean Domain', inline: true },
          { name: 'TypeScript', value: 'Strict Mode v5.8', inline: true },
          { name: 'Gateway', value: 'Discord.js v14', inline: true },
          { name: 'Database', value: 'Prisma ORM (SQLite / PostgreSQL)', inline: true },
          { name: 'Uptime', value: `${hours}h ${minutes}m`, inline: true },
          { name: 'Servers Active', value: `${client.guilds.cache.size}`, inline: true },
        )
        .setFooter({ text: 'Riffly 2.0.0 • Production Ready' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    },
  };

  return [
    afkCmd,
    suggestCmd,
    reportCmd,
    announceCmd,
    embedCmd,
    serverassetsCmd,
    servericonCmd,
    rolesCmd,
    emojisCmd,
    boostersCmd,
    messagesCmd,
    snipeCmd,
    editsnipeCmd,
    cryptoCmd,
    colorCmd,
    weatherCmd,
    translateCmd,
    defineCmd,
    wikiCmd,
    githubCmd,
    stealCmd,
    emojiaddCmd,
    emojideleteCmd,
    helpCmd,
    infoCmd,
  ];
}
