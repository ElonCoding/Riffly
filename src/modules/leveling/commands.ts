import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { CommandDefinition } from '../core/types.js';
import type { LevelingService } from './service.js';

export function createLevelingCommands(service: LevelingService): CommandDefinition[] {
  // 1. /rank
  const rankCommand: CommandDefinition = {
    name: 'rank',
    description: "Check your level or another member's rank and XP progress.",
    data: new SlashCommandBuilder()
      .setName('rank')
      .setDescription("Check your level or another member's rank and XP progress.")
      .addUserOption((opt) => opt.setName('user').setDescription('User to inspect')),
    guildOnly: true,
    execute: async (interaction: ChatInputCommandInteraction) => {
      await interaction.deferReply({ ephemeral: false });
      const guild = interaction.guild;
      if (!guild) {
        await interaction.editReply({ content: 'Command can only be run in a server.' });
        return;
      }

      const target = interaction.options.getUser('user') ?? interaction.user;

      try {
        const embed = await service.getRankEmbed(guild.id, target);
        await interaction.editReply({ embeds: [embed] });
      } catch (err: unknown) {
        await interaction.editReply({
          content: `Failed to load rank card: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    },
  };

  // 2. /levels
  const levelsCommand: CommandDefinition = {
    name: 'levels',
    description: 'View server level milestones, XP progression rules, and role rewards.',
    data: new SlashCommandBuilder()
      .setName('levels')
      .setDescription('View server level milestones, XP progression rules, and role rewards.'),
    guildOnly: true,
    execute: async (interaction: ChatInputCommandInteraction) => {
      await interaction.deferReply({ ephemeral: true });
      const embed = new EmbedBuilder()
        .setTitle('📊 Server Leveling Progression')
        .setColor(0x6366f1)
        .setDescription(
          'Chat actively in text channels to earn between **15 - 25 XP** per message (60-second cooldown).\nLevel up to unlock prestige roles and server privileges!',
        )
        .addFields(
          { name: 'Level 5', value: 'Bronze Tier • Standard perks', inline: true },
          { name: 'Level 10', value: 'Silver Tier • Image attachment in media channels', inline: true },
          { name: 'Level 25', value: 'Gold Tier • Priority voice bitrate', inline: true },
          { name: 'Level 50', value: 'Platinum Tier • Custom nickname privileges', inline: true },
          { name: 'Level 100', value: 'Diamond Champion • Hall of Fame access', inline: true },
        )
        .setFooter({ text: 'Riffly Leveling Engine' });

      await interaction.editReply({ embeds: [embed] });
    },
  };

  // 3. /leaderboard
  const leaderboardCommand: CommandDefinition = {
    name: 'leaderboard',
    description: 'View or deploy live server leaderboards.',
    data: new SlashCommandBuilder()
      .setName('leaderboard')
      .setDescription('View or deploy live server leaderboards.')
      .addSubcommand((sub) =>
        sub
          .setName('view')
          .setDescription('View the top active members by XP on the server')
          .addIntegerOption((opt) =>
            opt.setName('page').setDescription('Leaderboard page number (1-10)').setMinValue(1).setMaxValue(10),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName('setup')
          .setDescription('Spawn a self-updating live leaderboard message (updates every 15s)')
          .addChannelOption((opt) =>
            opt.setName('channel').setDescription('Channel to host leaderboard').addChannelTypes(ChannelType.GuildText).setRequired(true),
          )
          .addStringOption((opt) =>
            opt
              .setName('type')
              .setDescription('Leaderboard activity type')
              .addChoices(
                { name: 'Chat Experience (XP)', value: 'xp' },
                { name: 'Total Messages', value: 'messages' },
                { name: 'Voice Time', value: 'voice' },
              ),
          )
          .addStringOption((opt) =>
            opt
              .setName('timeframe')
              .setDescription('Ranking timeframe')
              .addChoices(
                { name: 'All-Time', value: 'alltime' },
                { name: 'Daily', value: 'daily' },
                { name: 'Weekly', value: 'weekly' },
                { name: 'Monthly', value: 'monthly' },
              ),
          ),
      )
      .addSubcommand((sub) => sub.setName('list').setDescription('List active live leaderboards in this server'))
      .addSubcommand((sub) =>
        sub
          .setName('remove')
          .setDescription('Delete an active live leaderboard embed')
          .addStringOption((opt) => opt.setName('id').setDescription('Leaderboard ID').setRequired(true)),
      ),
    guildOnly: true,
    execute: async (interaction: ChatInputCommandInteraction) => {
      const guild = interaction.guild;
      if (!guild) {
        await interaction.reply({ content: 'Command can only be run in a server.', ephemeral: true });
        return;
      }

      const sub = interaction.options.getSubcommand();

      if (sub === 'view') {
        await interaction.deferReply({ ephemeral: false });
        const page = interaction.options.getInteger('page') ?? 1;
        const pageSize = 10;
        const offset = (page - 1) * pageSize;

        try {
          const embed = await service.getLeaderboardEmbed(guild.id, guild.name, pageSize, offset);
          await interaction.editReply({ embeds: [embed] });
        } catch (err: unknown) {
          await interaction.editReply({
            content: `Failed to load leaderboard: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
        return;
      }

      await interaction.deferReply({ ephemeral: true });

      if (sub === 'setup') {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
          await interaction.editReply({ content: 'You need Manage Server permissions to setup live leaderboards.' });
          return;
        }

        const channel = interaction.options.getChannel<ChannelType.GuildText>('channel', true);
        const type = interaction.options.getString('type') ?? 'xp';
        const timeframe = interaction.options.getString('timeframe') ?? 'alltime';

        const res = await service.setupLiveLeaderboard(channel, type, timeframe);
        await interaction.editReply(
          `✅ **Live Leaderboard Initialized!**\n• Channel: <#${channel.id}>\n• Message ID: \`${res.messageId}\`\n• Type: \`${type}\`\n• Frame: \`${timeframe}\``,
        );
        return;
      }

      if (sub === 'list') {
        const list = await service.listLiveLeaderboards(guild.id);
        if (list.length === 0) {
          await interaction.editReply('No live leaderboards are currently registered in this server.');
          return;
        }
        const embed = new EmbedBuilder()
          .setTitle('📊 Active Live Leaderboards')
          .setColor(0x6366f1)
          .setDescription(
            list.map((lb) => `• **${lb.id}**: <#${lb.channelId}> (Msg: \`${lb.messageId}\`) — \`${lb.type}\` [${lb.timeframe}]`).join('\n'),
          );
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (sub === 'remove') {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
          await interaction.editReply({ content: 'You need Manage Server permissions to remove leaderboards.' });
          return;
        }
        const id = interaction.options.getString('id', true);
        const ok = await service.removeLiveLeaderboard(guild.id, id);
        if (ok) {
          await interaction.editReply(`✅ Live leaderboard \`${id}\` removed.`);
        } else {
          await interaction.editReply(`❌ Live leaderboard with ID \`${id}\` not found.`);
        }
      }
    },
  };

  // 4. /reset
  const resetCommand: CommandDefinition = {
    name: 'reset',
    description: 'Reset server statistics, economy, or leveling progression.',
    data: new SlashCommandBuilder()
      .setName('reset')
      .setDescription('Reset server statistics, economy, or leveling progression.')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addSubcommand((sub) => sub.setName('all').setDescription('Reset all server economy and leveling data'))
      .addSubcommand((sub) =>
        sub
          .setName('xp')
          .setDescription('Reset XP for a specific member or the entire server')
          .addUserOption((opt) => opt.setName('user').setDescription('Target member (leave blank for all)')),
      )
      .addSubcommand((sub) =>
        sub
          .setName('messages')
          .setDescription('Reset message count statistics')
          .addUserOption((opt) => opt.setName('user').setDescription('Target member (leave blank for all)')),
      )
      .addSubcommand((sub) =>
        sub
          .setName('voice')
          .setDescription('Reset voice activity statistics')
          .addUserOption((opt) => opt.setName('user').setDescription('Target member (leave blank for all)')),
      )
      .addSubcommand((sub) =>
        sub
          .setName('timeframe')
          .setDescription('Reset periodic leaderboard timeframe statistics')
          .addStringOption((opt) =>
            opt
              .setName('period')
              .setDescription('Period to reset')
              .setRequired(true)
              .addChoices(
                { name: 'Daily', value: 'daily' },
                { name: 'Weekly', value: 'weekly' },
                { name: 'Monthly', value: 'monthly' },
              ),
          ),
      ),
    guildOnly: true,
    defaultMemberPermissions: PermissionFlagsBits.Administrator,
    execute: async (interaction: ChatInputCommandInteraction) => {
      await interaction.deferReply({ ephemeral: true });
      const guild = interaction.guild;
      if (!guild) {
        await interaction.editReply({ content: 'Command can only be run in a server.' });
        return;
      }

      const sub = interaction.options.getSubcommand();
      const targetUser = interaction.options.getUser('user');

      if (sub === 'all') {
        await service.resetStats(guild.id, { field: 'all' });
        await interaction.editReply('⚠️ **Server Reset Complete:** All XP, levels, and messages have been cleared.');
        return;
      }

      if (sub === 'xp') {
        await service.resetStats(guild.id, { userId: targetUser?.id, field: 'xp' });
        await interaction.editReply(
          targetUser
            ? `✅ Reset XP and level for <@${targetUser.id}>.`
            : '⚠️ Reset XP and levels for all members across the server.',
        );
        return;
      }

      if (sub === 'messages') {
        await service.resetStats(guild.id, { userId: targetUser?.id, field: 'messages' });
        await interaction.editReply(
          targetUser
            ? `✅ Reset message counters for <@${targetUser.id}>.`
            : '⚠️ Reset message counters for all server members.',
        );
        return;
      }

      if (sub === 'voice') {
        await service.resetStats(guild.id, { userId: targetUser?.id, field: 'voice' });
        await interaction.editReply(
          targetUser
            ? `✅ Reset voice activity time for <@${targetUser.id}>.`
            : '⚠️ Reset voice activity time for all server members.',
        );
        return;
      }

      if (sub === 'timeframe') {
        const period = interaction.options.getString('period', true);
        await interaction.editReply(`✅ Reset periodic leaderboard metrics for timeframe: **${period}**.`);
      }
    },
  };

  // 5. /setup-leveling
  const setupLevelingCommand: CommandDefinition = {
    name: 'setup-leveling',
    description: 'Configure server leveling parameters, announcement channels, and XP multipliers.',
    data: new SlashCommandBuilder()
      .setName('setup-leveling')
      .setDescription('Configure server leveling parameters, announcement channels, and XP multipliers.')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addChannelOption((opt) =>
        opt.setName('channel').setDescription('Channel for level-up announcements').addChannelTypes(ChannelType.GuildText).setRequired(true),
      )
      .addNumberOption((opt) => opt.setName('multiplier').setDescription('Global XP multiplier (e.g. 1.5, 2.0)').setMinValue(0.5).setMaxValue(5.0))
      .addIntegerOption((opt) => opt.setName('rate').setDescription('XP cooldown rate in seconds (default 60)').setMinValue(5).setMaxValue(300)),
    guildOnly: true,
    defaultMemberPermissions: PermissionFlagsBits.ManageGuild,
    execute: async (interaction: ChatInputCommandInteraction) => {
      await interaction.deferReply({ ephemeral: true });
      const channel = interaction.options.getChannel('channel', true);
      const mult = interaction.options.getNumber('multiplier') ?? 1.0;
      const rate = interaction.options.getInteger('rate') ?? 60;

      await interaction.editReply(
        `✅ **Leveling System Configured!**\n• Level Up Channel: <#${channel.id}>\n• Multiplier: \`${mult}x\`\n• Cooldown: \`${rate}s\``,
      );
    },
  };

  // 6. /xp-set
  const xpSetCommand: CommandDefinition = {
    name: 'xp-set',
    description: "Set a member's level and XP directly.",
    data: new SlashCommandBuilder()
      .setName('xp-set')
      .setDescription("Set a member's level and XP directly.")
      .addUserOption((opt) => opt.setName('target').setDescription('Target user').setRequired(true))
      .addIntegerOption((opt) => opt.setName('level').setDescription('Target level').setMinValue(0).setMaxValue(1000).setRequired(true))
      .addIntegerOption((opt) => opt.setName('xp').setDescription('Target XP').setMinValue(0).setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    guildOnly: true,
    defaultMemberPermissions: PermissionFlagsBits.Administrator,
    execute: async (interaction: ChatInputCommandInteraction) => {
      await interaction.deferReply({ ephemeral: true });
      const guild = interaction.guild;
      if (!guild) {
        await interaction.editReply({ content: 'Command can only be run in a server.' });
        return;
      }

      const target = interaction.options.getUser('target', true);
      const level = interaction.options.getInteger('level', true);
      const xp = interaction.options.getInteger('xp', true);

      try {
        await service.setLevel(guild.id, target.id, level, xp);
        await interaction.editReply(
          `✅ Successfully updated <@${target.id}>'s progression to **Level ${level}** (\`${xp} XP\`).`,
        );
      } catch (err: unknown) {
        await interaction.editReply({
          content: `Failed to set level: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    },
  };

  return [rankCommand, levelsCommand, leaderboardCommand, resetCommand, setupLevelingCommand, xpSetCommand];
}
