import {
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import type { CommandDefinition } from '../core/types.js';
import type { LevelingService } from './service.js';

export function createLevelingCommands(service: LevelingService): CommandDefinition[] {
  const rankCommand: CommandDefinition = {
    name: 'rank',
    description: 'Check your level or another member\'s rank and XP progress.',
    data: new SlashCommandBuilder()
      .setName('rank')
      .setDescription('Check your level or another member\'s rank and XP progress.')
      .addUserOption((opt) =>
        opt.setName('user').setDescription('User to inspect').setRequired(false),
      ),
    guildOnly: true,
    execute: async (interaction) => {
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

  const leaderboardCommand: CommandDefinition = {
    name: 'leaderboard',
    description: 'View the top active members by XP on the server.',
    data: new SlashCommandBuilder()
      .setName('leaderboard')
      .setDescription('View the top active members by XP on the server.')
      .addIntegerOption((opt) =>
        opt
          .setName('page')
          .setDescription('Leaderboard page number (1-10)')
          .setMinValue(1)
          .setMaxValue(10)
          .setRequired(false),
      ),
    guildOnly: true,
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: false });
      const guild = interaction.guild;
      if (!guild) {
        await interaction.editReply({ content: 'Command can only be run in a server.' });
        return;
      }

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
    },
  };

  const xpSetCommand: CommandDefinition = {
    name: 'xp-set',
    description: 'Set a member\'s level and XP directly.',
    data: new SlashCommandBuilder()
      .setName('xp-set')
      .setDescription('Set a member\'s level and XP directly.')
      .addUserOption((opt) =>
        opt.setName('target').setDescription('Target user').setRequired(true),
      )
      .addIntegerOption((opt) =>
        opt
          .setName('level')
          .setDescription('Target level')
          .setMinValue(0)
          .setMaxValue(1000)
          .setRequired(true),
      )
      .addIntegerOption((opt) =>
        opt
          .setName('xp')
          .setDescription('Target XP')
          .setMinValue(0)
          .setRequired(true),
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    guildOnly: true,
    defaultMemberPermissions: PermissionFlagsBits.Administrator,
    execute: async (interaction) => {
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
        await interaction.editReply({
          content: `✅ Updated <@${target.id}>: Level set to **${level}**, XP set to **${xp.toLocaleString()}**.`,
        });
      } catch (err: unknown) {
        await interaction.editReply({
          content: `Failed to set user XP: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    },
  };

  return [rankCommand, leaderboardCommand, xpSetCommand];
}

