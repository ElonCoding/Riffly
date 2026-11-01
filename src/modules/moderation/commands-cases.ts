/**
 * Moderation cases, warnings, staff notes, and jail commands.
 */

import {
  EmbedBuilder,
  GuildMember,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Role,
} from 'discord.js';
import type { CommandDefinition } from '../core/types.js';
import type { ModerationService } from './service.js';

export function createCaseModerationCommands(service: ModerationService): CommandDefinition[] {
  const warningsCmd: CommandDefinition = {
    name: 'warnings',
    description: 'View all infraction cases for a member.',
    data: new SlashCommandBuilder()
      .setName('warnings')
      .setDescription('View infractions for a user.')
      .addUserOption((opt) => opt.setName('user').setDescription('Target user').setRequired(true))
      .addStringOption((opt) =>
        opt
          .setName('type')
          .setDescription('Filter by action type')
          .addChoices(
            { name: 'All Infractions', value: 'all' },
            { name: 'Warnings', value: 'warn' },
            { name: 'Timeouts / Mutes', value: 'timeout' },
            { name: 'Bans', value: 'ban' },
            { name: 'Staff Notes', value: 'note' },
          )
          .setRequired(false),
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({ content: '❌ Guild only.', ephemeral: true });
        return;
      }
      const user = interaction.options.getUser('user', true);
      const filterType = interaction.options.getString('type') ?? 'all';

      const cases = await service.getHistory(interaction.guild.id, user.id);
      const filtered = filterType === 'all' ? cases : cases.filter((c) => c.action === filterType);

      if (filtered.length === 0) {
        await interaction.reply({
          content: `🟢 Clean record! No infractions found for <@${user.id}>.`,
          ephemeral: true,
        });
        return;
      }

      const lines = filtered.slice(0, 15).map(
        (c) =>
          `• **#${c.caseNumber}** [${c.action.toUpperCase()}] <t:${Math.floor(new Date(c.createdAt).getTime() / 1000)}:d> — ${c.reason ?? 'No reason provided.'}`,
      );

      const embed = new EmbedBuilder()
        .setTitle(`📋 Infraction Record: ${user.tag}`)
        .setColor(0xe67e22)
        .setDescription(lines.join('\n'))
        .setFooter({ text: `Total infractions: ${filtered.length}` })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    },
  };

  const clearwarnsCmd: CommandDefinition = {
    name: 'clearwarns',
    description: 'Clear all active warnings for a member.',
    data: new SlashCommandBuilder()
      .setName('clearwarns')
      .setDescription('Clear all active warnings for a member.')
      .addUserOption((opt) => opt.setName('user').setDescription('Target user').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({ content: '❌ Guild only.', ephemeral: true });
        return;
      }
      const user = interaction.options.getUser('user', true);
      const cleared = await service.clearWarnings(interaction.guild.id, user.id);
      await interaction.reply({
        content: `🧹 Cleared **${cleared}** active warning(s) for <@${user.id}>.`,
      });
    },
  };

  const noteCmd: CommandDefinition = {
    name: 'note',
    description: 'Manage private staff moderation notes on members.',
    data: new SlashCommandBuilder()
      .setName('note')
      .setDescription('Manage private staff notes.')
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addSubcommand((sub) =>
        sub
          .setName('add')
          .setDescription('Add a private staff note for a member.')
          .addUserOption((opt) => opt.setName('user').setDescription('Target user').setRequired(true))
          .addStringOption((opt) => opt.setName('note').setDescription('Note content').setRequired(true)),
      )
      .addSubcommand((sub) =>
        sub
          .setName('view')
          .setDescription('View all staff notes for a member.')
          .addUserOption((opt) => opt.setName('user').setDescription('Target user').setRequired(true)),
      )
      .addSubcommand((sub) =>
        sub
          .setName('remove')
          .setDescription('Remove a staff note by case number.')
          .addIntegerOption((opt) => opt.setName('case_id').setDescription('Case number').setRequired(true)),
      ),
    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({ content: '❌ Guild only.', ephemeral: true });
        return;
      }
      const sub = interaction.options.getSubcommand();

      if (sub === 'add') {
        const user = interaction.options.getUser('user', true);
        const content = interaction.options.getString('note', true);
        const modCase = await service.addNote(interaction.guild.id, user.id, interaction.user.id, content);
        await interaction.reply({
          content: `📝 Added staff note for <@${user.id}> (Case #${modCase.caseNumber}).`,
          ephemeral: true,
        });
        return;
      }

      if (sub === 'view') {
        const user = interaction.options.getUser('user', true);
        const allCases = await service.getHistory(interaction.guild.id, user.id);
        const notes = allCases.filter((c) => c.action === 'note');
        if (notes.length === 0) {
          await interaction.reply({ content: `📂 No staff notes on file for <@${user.id}>.`, ephemeral: true });
          return;
        }

        const lines = notes.map(
          (n) => `• **#${n.caseNumber}** (<@${n.moderatorId}>): ${n.reason}`,
        );

        const embed = new EmbedBuilder()
          .setTitle(`📝 Staff Notes: ${user.tag}`)
          .setColor(0x95a5a6)
          .setDescription(lines.join('\n'));

        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
      }

      if (sub === 'remove') {
        const caseId = interaction.options.getInteger('case_id', true);
        const deleted = await service.removeNote(interaction.guild.id, caseId);
        await interaction.reply({
          content: deleted ? `✅ Removed note #${caseId}.` : `❌ Note #${caseId} not found.`,
          ephemeral: true,
        });
      }
    },
  };

  const caseCmd: CommandDefinition = {
    name: 'case',
    description: 'Inspect a specific moderation case by its case number.',
    data: new SlashCommandBuilder()
      .setName('case')
      .setDescription('Inspect a moderation case.')
      .addIntegerOption((opt) => opt.setName('id').setDescription('Case number').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({ content: '❌ Guild only.', ephemeral: true });
        return;
      }
      const caseNumber = interaction.options.getInteger('id', true);
      const modCase = await (service as unknown as { repository: import('../../database/types.js').IModerationRepository }).repository.getCase(interaction.guild.id, caseNumber);

      if (!modCase) {
        await interaction.reply({ content: `❌ Case #${caseNumber} does not exist.`, ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`⚖️ Case #${modCase.caseNumber} • ${modCase.action.toUpperCase()}`)
        .setColor(0x34495e)
        .addFields(
          { name: 'Target', value: `<@${modCase.targetId}> (\`${modCase.targetId}\`)`, inline: true },
          { name: 'Moderator', value: `<@${modCase.moderatorId}>`, inline: true },
          { name: 'Status', value: modCase.active ? '🟢 Active' : '⚪ Resolved', inline: true },
          { name: 'Reason', value: modCase.reason ?? 'No reason provided.', inline: false },
        )
        .setTimestamp(new Date(modCase.createdAt));

      await interaction.reply({ embeds: [embed] });
    },
  };

  const editcaseCmd: CommandDefinition = {
    name: 'editcase',
    description: 'Edit the logged reason of an infraction case.',
    data: new SlashCommandBuilder()
      .setName('editcase')
      .setDescription('Edit case reason.')
      .addIntegerOption((opt) => opt.setName('id').setDescription('Case number').setRequired(true))
      .addStringOption((opt) => opt.setName('reason').setDescription('Updated reason').setRequired(true))
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({ content: '❌ Guild only.', ephemeral: true });
        return;
      }
      const caseNumber = interaction.options.getInteger('id', true);
      const newReason = interaction.options.getString('reason', true);

      const repo = (service as unknown as { repository: import('../../database/types.js').IModerationRepository }).repository;
      const updated = await repo.updateCase(interaction.guild.id, caseNumber, { reason: newReason });

      if (!updated) {
        await interaction.reply({ content: `❌ Case #${caseNumber} not found.`, ephemeral: true });
        return;
      }

      await interaction.reply({
        content: `✅ Case #${caseNumber} reason updated to: "${newReason}"`,
      });
    },
  };

  const jailCmd: CommandDefinition = {
    name: 'jail',
    description: 'Confine a member to an isolation jail channel or release them.',
    data: new SlashCommandBuilder()
      .setName('jail')
      .setDescription('Manage jailed members.')
      .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
      .addSubcommand((sub) =>
        sub
          .setName('member')
          .setDescription('Jail a member, strip their roles, and confine them.')
          .addUserOption((opt) => opt.setName('user').setDescription('Member to jail').setRequired(true))
          .addRoleOption((opt) => opt.setName('jail_role').setDescription('Jail isolation role').setRequired(true))
          .addStringOption((opt) => opt.setName('reason').setDescription('Reason').setRequired(false)),
      )
      .addSubcommand((sub) =>
        sub
          .setName('remove')
          .setDescription('Release a member from jail and restore roles.')
          .addUserOption((opt) => opt.setName('user').setDescription('Member to release').setRequired(true))
          .addRoleOption((opt) => opt.setName('jail_role').setDescription('Jail role to remove').setRequired(true)),
      ),
    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.inGuild() || !interaction.guild || !(interaction.member instanceof GuildMember)) {
        await interaction.reply({ content: '❌ Guild only.', ephemeral: true });
        return;
      }

      const sub = interaction.options.getSubcommand();
      const user = interaction.options.getUser('user', true);
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);

      if (!member) {
        await interaction.reply({ content: '❌ Member not found.', ephemeral: true });
        return;
      }

      const jailRole = interaction.options.getRole('jail_role', true) as Role;

      if (sub === 'member') {
        const reason = interaction.options.getString('reason') ?? undefined;
        service.checkHierarchy(interaction.member, member, interaction.guild.members.me ?? undefined);
        await service.jailMember(interaction.guild, member, jailRole, reason);
        await interaction.reply({
          content: `🚨 Jailed <@${user.id}>. Roles stripped and isolation role applied.`,
        });
        return;
      }

      if (sub === 'remove') {
        await member.roles.remove(jailRole);
        await interaction.reply({
          content: `🕊️ Released <@${user.id}> from jail.`,
        });
      }
    },
  };

  return [warningsCmd, clearwarnsCmd, noteCmd, caseCmd, editcaseCmd, jailCmd];
}

