import {
  EmbedBuilder,
  GuildMember,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import type { TextChannel } from 'discord.js';
import type { CommandDefinition } from '../core/types.js';
import type { ModerationService } from './service.js';

export function createModerationCommands(service: ModerationService): CommandDefinition[] {
  const banCommand: CommandDefinition = {
    name: 'ban',
    description: 'Ban a member from the server and record a case.',
    data: new SlashCommandBuilder()
      .setName('ban')
      .setDescription('Ban a member from the server and record a case.')
      .addUserOption((opt) =>
        opt.setName('target').setDescription('The user to ban').setRequired(true),
      )
      .addStringOption((opt) =>
        opt.setName('reason').setDescription('Reason for the ban').setRequired(false),
      )
      .addIntegerOption((opt) =>
        opt
          .setName('delete_days')
          .setDescription('Days of messages to delete (0-7)')
          .setMinValue(0)
          .setMaxValue(7)
          .setRequired(false),
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    guildOnly: true,
    defaultMemberPermissions: PermissionFlagsBits.BanMembers,
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: false });
      const guild = interaction.guild;
      const moderator = interaction.member;
      if (!guild || !moderator || !(moderator instanceof GuildMember)) {
        await interaction.editReply({ content: 'Command can only be run in a server.' });
        return;
      }

      const target = interaction.options.getUser('target', true);
      const reason = interaction.options.getString('reason') ?? undefined;
      const deleteDays = interaction.options.getInteger('delete_days') ?? 0;

      try {
        const result = await service.ban(guild, moderator, target, reason, deleteDays);
        const embed = new EmbedBuilder()
          .setTitle('🔨 Member Banned')
          .setColor(0xe02424)
          .setDescription(result.message)
          .addFields(
            { name: 'Target', value: `<@${target.id}> (${target.id})`, inline: true },
            { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Reason', value: reason ?? 'No reason provided.', inline: false },
          )
          .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
      } catch (err: unknown) {
        await interaction.editReply({
          content: `Failed to ban user: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    },
  };

  const kickCommand: CommandDefinition = {
    name: 'kick',
    description: 'Kick a member from the server and record a case.',
    data: new SlashCommandBuilder()
      .setName('kick')
      .setDescription('Kick a member from the server and record a case.')
      .addUserOption((opt) =>
        opt.setName('target').setDescription('The member to kick').setRequired(true),
      )
      .addStringOption((opt) =>
        opt.setName('reason').setDescription('Reason for the kick').setRequired(false),
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
    guildOnly: true,
    defaultMemberPermissions: PermissionFlagsBits.KickMembers,
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: false });
      const guild = interaction.guild;
      const moderator = interaction.member;
      if (!guild || !moderator || !(moderator instanceof GuildMember)) {
        await interaction.editReply({ content: 'Command can only be run in a server.' });
        return;
      }

      const targetUser = interaction.options.getUser('target', true);
      const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
      if (!targetMember) {
        await interaction.editReply({ content: 'Target member is not in the server.' });
        return;
      }

      const reason = interaction.options.getString('reason') ?? undefined;

      try {
        const result = await service.kick(guild, moderator, targetMember, reason);
        const embed = new EmbedBuilder()
          .setTitle('👢 Member Kicked')
          .setColor(0xf59e0b)
          .setDescription(result.message)
          .addFields(
            { name: 'Target', value: `<@${targetUser.id}>`, inline: true },
            { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Reason', value: reason ?? 'No reason provided.', inline: false },
          )
          .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
      } catch (err: unknown) {
        await interaction.editReply({
          content: `Failed to kick member: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    },
  };

  const timeoutCommand: CommandDefinition = {
    name: 'timeout',
    description: 'Timeout a member for a specified duration.',
    data: new SlashCommandBuilder()
      .setName('timeout')
      .setDescription('Timeout a member for a specified duration.')
      .addUserOption((opt) =>
        opt.setName('target').setDescription('The member to timeout').setRequired(true),
      )
      .addIntegerOption((opt) =>
        opt
          .setName('seconds')
          .setDescription('Timeout duration in seconds (max 2419200 / 28 days)')
          .setMinValue(5)
          .setMaxValue(2419200)
          .setRequired(true),
      )
      .addStringOption((opt) =>
        opt.setName('reason').setDescription('Reason for the timeout').setRequired(false),
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    guildOnly: true,
    defaultMemberPermissions: PermissionFlagsBits.ModerateMembers,
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: false });
      const guild = interaction.guild;
      const moderator = interaction.member;
      if (!guild || !moderator || !(moderator instanceof GuildMember)) {
        await interaction.editReply({ content: 'Command can only be run in a server.' });
        return;
      }

      const targetUser = interaction.options.getUser('target', true);
      const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
      if (!targetMember) {
        await interaction.editReply({ content: 'Target member is not in the server.' });
        return;
      }

      const seconds = interaction.options.getInteger('seconds', true);
      const reason = interaction.options.getString('reason') ?? undefined;

      try {
        const result = await service.timeout(
          guild,
          moderator,
          targetMember,
          seconds * 1000,
          reason,
        );
        const embed = new EmbedBuilder()
          .setTitle('⏳ Member Timed Out')
          .setColor(0x3b82f6)
          .setDescription(result.message)
          .addFields(
            { name: 'Target', value: `<@${targetUser.id}>`, inline: true },
            { name: 'Duration', value: `${seconds}s`, inline: true },
            { name: 'Reason', value: reason ?? 'No reason provided.', inline: false },
          )
          .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
      } catch (err: unknown) {
        await interaction.editReply({
          content: `Failed to timeout member: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    },
  };

  const warnCommand: CommandDefinition = {
    name: 'warn',
    description: 'Issue a formal warning to a member.',
    data: new SlashCommandBuilder()
      .setName('warn')
      .setDescription('Issue a formal warning to a member.')
      .addUserOption((opt) =>
        opt.setName('target').setDescription('The member to warn').setRequired(true),
      )
      .addStringOption((opt) =>
        opt.setName('reason').setDescription('Reason for warning').setRequired(true),
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    guildOnly: true,
    defaultMemberPermissions: PermissionFlagsBits.ModerateMembers,
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: false });
      const guild = interaction.guild;
      const moderator = interaction.member;
      if (!guild || !moderator || !(moderator instanceof GuildMember)) {
        await interaction.editReply({ content: 'Command can only be run in a server.' });
        return;
      }

      const target = interaction.options.getUser('target', true);
      const reason = interaction.options.getString('reason', true);

      try {
        const result = await service.warn(guild, moderator, target, reason);
        const embed = new EmbedBuilder()
          .setTitle('⚠️ Member Warned')
          .setColor(0xeab308)
          .setDescription(result.message)
          .addFields(
            { name: 'Target', value: `<@${target.id}>`, inline: true },
            { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Reason', value: reason, inline: false },
          )
          .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
      } catch (err: unknown) {
        await interaction.editReply({
          content: `Failed to warn user: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    },
  };

  const casesCommand: CommandDefinition = {
    name: 'cases',
    description: 'View moderation history for a user.',
    data: new SlashCommandBuilder()
      .setName('cases')
      .setDescription('View moderation history for a user.')
      .addUserOption((opt) =>
        opt.setName('target').setDescription('The user to inspect').setRequired(true),
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    guildOnly: true,
    defaultMemberPermissions: PermissionFlagsBits.ModerateMembers,
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: true });
      const guild = interaction.guild;
      if (!guild) {
        await interaction.editReply({ content: 'Command can only be run in a server.' });
        return;
      }

      const target = interaction.options.getUser('target', true);
      const history = await service.getHistory(guild.id, target.id);

      if (history.length === 0) {
        await interaction.editReply({
          content: `No moderation cases found for <@${target.id}>. Clean record!`,
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`📋 Moderation Cases for ${target.tag}`)
        .setColor(0x6366f1)
        .setDescription(
          history
            .slice(0, 10)
            .map(
              (c) =>
                `**#${c.caseNumber}** [${c.action.toUpperCase()}] by <@${c.moderatorId}> — ${c.reason ?? 'No reason'} (<t:${Math.floor(c.createdAt.getTime() / 1000)}:R>)`,
            )
            .join('\n'),
        )
        .setFooter({ text: `Total cases: ${history.length}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    },
  };

  const purgeCommand: CommandDefinition = {
    name: 'purge',
    description: 'Bulk delete up to 100 messages from the current channel.',
    data: new SlashCommandBuilder()
      .setName('purge')
      .setDescription('Bulk delete up to 100 messages from the current channel.')
      .addIntegerOption((opt) =>
        opt
          .setName('amount')
          .setDescription('Number of messages to delete (1-100)')
          .setMinValue(1)
          .setMaxValue(100)
          .setRequired(true),
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    guildOnly: true,
    defaultMemberPermissions: PermissionFlagsBits.ManageMessages,
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: true });
      const channel = interaction.channel;
      const moderator = interaction.member;
      if (!channel || !('bulkDelete' in channel) || !moderator || !(moderator instanceof GuildMember)) {
        await interaction.editReply({ content: 'Can only purge messages in text channels.' });
        return;
      }

      const amount = interaction.options.getInteger('amount', true);

      try {
        const { deletedCount } = await service.purge(channel as TextChannel, moderator, amount);
        await interaction.editReply({
          content: `🧹 Successfully purged ${deletedCount} messages.`,
        });
      } catch (err: unknown) {
        await interaction.editReply({
          content: `Failed to purge messages: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    },
  };

  return [banCommand, kickCommand, timeoutCommand, warnCommand, casesCommand, purgeCommand];
}
