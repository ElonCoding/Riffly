import { EmbedBuilder, GuildMember, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { TextChannel } from 'discord.js';
import type { CommandDefinition } from '../core/types.js';
import type { ModerationService } from './service.js';
import { createChannelModerationCommands } from './commands-channel.js';
import { createRoleModerationCommands } from './commands-role.js';
import { createCaseModerationCommands } from './commands-cases.js';
import { createVoiceModerationCommands } from './commands-voice.js';

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

  const unbanCommand: CommandDefinition = {
    name: 'unban',
    description: 'Unban a user by ID.',
    data: new SlashCommandBuilder()
      .setName('unban')
      .setDescription('Unban a user by their Discord user ID.')
      .addStringOption((opt) =>
        opt.setName('user_id').setDescription('User ID to unban').setRequired(true),
      )
      .addStringOption((opt) => opt.setName('reason').setDescription('Reason').setRequired(false))
      .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    guildOnly: true,
    execute: async (interaction) => {
      if (
        !interaction.inGuild() ||
        !interaction.guild ||
        !(interaction.member instanceof GuildMember)
      ) {
        await interaction.reply({ content: '❌ Guild only.', ephemeral: true });
        return;
      }
      const targetId = interaction.options.getString('user_id', true);
      const reason = interaction.options.getString('reason') ?? undefined;

      try {
        const res = await service.unban(interaction.guild, interaction.member, targetId, reason);
        await interaction.reply({ content: `✅ ${res.message}` });
      } catch (err: unknown) {
        await interaction.reply({
          content: `❌ Failed to unban: ${err instanceof Error ? err.message : String(err)}`,
          ephemeral: true,
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

      const target = interaction.options.getUser('target', true);
      const targetMember = await guild.members.fetch(target.id).catch(() => null);
      if (!targetMember) {
        await interaction.editReply({ content: '❌ Member not found in server.' });
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
            { name: 'Target', value: `<@${target.id}> (${target.id})`, inline: true },
            { name: 'Moderator', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Reason', value: reason ?? 'No reason provided.', inline: false },
          )
          .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
      } catch (err: unknown) {
        await interaction.editReply({
          content: `Failed to kick user: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    },
  };

  const timeoutCommand: CommandDefinition = {
    name: 'timeout',
    description: 'Timeout a member for a specified duration in seconds.',
    data: new SlashCommandBuilder()
      .setName('timeout')
      .setDescription('Timeout a member.')
      .addUserOption((opt) =>
        opt.setName('target').setDescription('The member to timeout').setRequired(true),
      )
      .addIntegerOption((opt) =>
        opt
          .setName('seconds')
          .setDescription('Duration of timeout in seconds (max 2419200)')
          .setMinValue(10)
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

      const target = interaction.options.getUser('target', true);
      const targetMember = await guild.members.fetch(target.id).catch(() => null);
      if (!targetMember) {
        await interaction.editReply({ content: '❌ Member not found in server.' });
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
          .setColor(0x8b5cf6)
          .setDescription(result.message)
          .addFields(
            { name: 'Target', value: `<@${target.id}> (${target.id})`, inline: true },
            { name: 'Duration', value: `${seconds} seconds`, inline: true },
            { name: 'Reason', value: reason ?? 'No reason provided.', inline: false },
          )
          .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
      } catch (err: unknown) {
        await interaction.editReply({
          content: `Failed to timeout user: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    },
  };

  const muteCommand: CommandDefinition = {
    name: 'mute',
    description: 'Timeout a member with standard duration presets.',
    data: new SlashCommandBuilder()
      .setName('mute')
      .setDescription('Timeout a member with duration presets.')
      .addUserOption((opt) => opt.setName('target').setDescription('Target user').setRequired(true))
      .addStringOption((opt) =>
        opt
          .setName('duration')
          .setDescription('Duration preset')
          .setRequired(true)
          .addChoices(
            { name: '1 minute', value: '60000' },
            { name: '5 minutes', value: '300000' },
            { name: '10 minutes', value: '600000' },
            { name: '30 minutes', value: '1800000' },
            { name: '1 hour', value: '3600000' },
            { name: '6 hours', value: '21600000' },
            { name: '12 hours', value: '43200000' },
            { name: '1 day', value: '86400000' },
            { name: '3 days', value: '259200000' },
            { name: '7 days', value: '604800000' },
          ),
      )
      .addStringOption((opt) => opt.setName('reason').setDescription('Reason').setRequired(false))
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    guildOnly: true,
    execute: async (interaction) => {
      if (
        !interaction.inGuild() ||
        !interaction.guild ||
        !(interaction.member instanceof GuildMember)
      ) {
        await interaction.reply({ content: '❌ Server only.', ephemeral: true });
        return;
      }
      const targetUser = interaction.options.getUser('target', true);
      const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      if (!targetMember) {
        await interaction.reply({ content: '❌ Member not found in server.', ephemeral: true });
        return;
      }
      const durationMs = parseInt(interaction.options.getString('duration', true), 10);
      const reason = interaction.options.getString('reason') ?? undefined;

      try {
        const res = await service.timeout(
          interaction.guild,
          interaction.member,
          targetMember,
          durationMs,
          reason,
        );
        await interaction.reply({ content: `🔇 ${res.message}` });
      } catch (err: unknown) {
        await interaction.reply({
          content: `❌ ${err instanceof Error ? err.message : String(err)}`,
          ephemeral: true,
        });
      }
    },
  };

  const unmuteCommand: CommandDefinition = {
    name: 'unmute',
    description: 'Remove timeout from a member.',
    data: new SlashCommandBuilder()
      .setName('unmute')
      .setDescription('Remove timeout from a member.')
      .addUserOption((opt) =>
        opt.setName('target').setDescription('Target member').setRequired(true),
      )
      .addStringOption((opt) => opt.setName('reason').setDescription('Reason').setRequired(false))
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    guildOnly: true,
    execute: async (interaction) => {
      if (
        !interaction.inGuild() ||
        !interaction.guild ||
        !(interaction.member instanceof GuildMember)
      ) {
        await interaction.reply({ content: '❌ Server only.', ephemeral: true });
        return;
      }
      const targetUser = interaction.options.getUser('target', true);
      const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      if (!member) {
        await interaction.reply({ content: '❌ Member not found.', ephemeral: true });
        return;
      }

      try {
        const res = await service.unmute(interaction.guild, member, interaction.member);
        await interaction.reply({ content: `🔊 ${res.message}` });
      } catch (err: unknown) {
        await interaction.reply({
          content: `❌ ${err instanceof Error ? err.message : String(err)}`,
          ephemeral: true,
        });
      }
    },
  };

  const softbanCommand: CommandDefinition = {
    name: 'softban',
    description: 'Ban and immediately unban a member to delete message history.',
    data: new SlashCommandBuilder()
      .setName('softban')
      .setDescription('Ban and instantly unban a member to prune messages.')
      .addUserOption((opt) => opt.setName('target').setDescription('Target user').setRequired(true))
      .addStringOption((opt) => opt.setName('reason').setDescription('Reason').setRequired(false))
      .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    guildOnly: true,
    execute: async (interaction) => {
      if (
        !interaction.inGuild() ||
        !interaction.guild ||
        !(interaction.member instanceof GuildMember)
      ) {
        await interaction.reply({ content: '❌ Server only.', ephemeral: true });
        return;
      }
      const targetUser = interaction.options.getUser('target', true);
      const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      if (!targetMember) {
        await interaction.reply({ content: '❌ Member not found in server.', ephemeral: true });
        return;
      }
      const reason = interaction.options.getString('reason') ?? undefined;

      try {
        const res = await service.softban(
          interaction.guild,
          interaction.member,
          targetMember,
          reason,
        );
        await interaction.reply({ content: `🧹 ${res.message}` });
      } catch (err: unknown) {
        await interaction.reply({
          content: `❌ ${err instanceof Error ? err.message : String(err)}`,
          ephemeral: true,
        });
      }
    },
  };

  const warnCommand: CommandDefinition = {
    name: 'warn',
    description: 'Issue a formal infraction warning to a member.',
    data: new SlashCommandBuilder()
      .setName('warn')
      .setDescription('Warn a member and record the case.')
      .addUserOption((opt) =>
        opt.setName('target').setDescription('The member to warn').setRequired(true),
      )
      .addStringOption((opt) =>
        opt.setName('reason').setDescription('Reason for the warning').setRequired(true),
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
            { name: 'Target', value: `<@${target.id}> (${target.id})`, inline: true },
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
    description: 'View moderation history and cases for a user.',
    data: new SlashCommandBuilder()
      .setName('cases')
      .setDescription('View moderation history and cases for a user.')
      .addUserOption((opt) =>
        opt.setName('target').setDescription('The user to look up').setRequired(true),
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    guildOnly: true,
    defaultMemberPermissions: PermissionFlagsBits.ModerateMembers,
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: false });
      const guild = interaction.guild;
      if (!guild) {
        await interaction.editReply({ content: 'Command can only be run in a server.' });
        return;
      }

      const target = interaction.options.getUser('target', true);
      const history = await service.getHistory(guild.id, target.id);

      if (history.length === 0) {
        await interaction.editReply({
          content: `No moderation cases found for <@${target.id}>.`,
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`Moderation Cases for ${target.username}`)
        .setColor(0x3b82f6)
        .setDescription(
          history
            .slice(0, 10)
            .map(
              (c) =>
                `**#${c.caseNumber}** | \`${c.action.toUpperCase()}\` by <@${c.moderatorId}>\n` +
                `Reason: ${c.reason ?? 'None'} — <t:${Math.floor(new Date(c.createdAt).getTime() / 1000)}:R>`,
            )
            .join('\n\n'),
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
      if (
        !channel ||
        !('bulkDelete' in channel) ||
        !moderator ||
        !(moderator instanceof GuildMember)
      ) {
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

  return [
    banCommand,
    unbanCommand,
    kickCommand,
    timeoutCommand,
    muteCommand,
    unmuteCommand,
    softbanCommand,
    warnCommand,
    casesCommand,
    purgeCommand,
    ...createChannelModerationCommands(service),
    ...createRoleModerationCommands(service),
    ...createCaseModerationCommands(service),
    ...createVoiceModerationCommands(service),
  ];
}
