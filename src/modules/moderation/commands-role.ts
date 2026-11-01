/**
 * Role management and nickname moderation commands.
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

export function createRoleModerationCommands(service: ModerationService): CommandDefinition[] {
  const roleCmd: CommandDefinition = {
    name: 'role',
    description: 'Manage member roles and execute bulk role assignments.',
    data: new SlashCommandBuilder()
      .setName('role')
      .setDescription('Manage server roles and assignments.')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
      .addSubcommand((sub) =>
        sub
          .setName('add')
          .setDescription('Add a role to a member.')
          .addUserOption((opt) => opt.setName('user').setDescription('Target user').setRequired(true))
          .addRoleOption((opt) => opt.setName('role').setDescription('Role to assign').setRequired(true)),
      )
      .addSubcommand((sub) =>
        sub
          .setName('remove')
          .setDescription('Remove a role from a member.')
          .addUserOption((opt) => opt.setName('user').setDescription('Target user').setRequired(true))
          .addRoleOption((opt) => opt.setName('role').setDescription('Role to remove').setRequired(true)),
      )
      .addSubcommand((sub) =>
        sub
          .setName('info')
          .setDescription('View detailed metrics about a role.')
          .addRoleOption((opt) => opt.setName('role').setDescription('Role to inspect').setRequired(true)),
      )
      .addSubcommand((sub) =>
        sub
          .setName('bots')
          .setDescription('Mass assign a role to all bots in the server.')
          .addRoleOption((opt) => opt.setName('role').setDescription('Role to assign').setRequired(true)),
      )
      .addSubcommand((sub) =>
        sub
          .setName('remove-bots')
          .setDescription('Mass remove a role from all bots in the server.')
          .addRoleOption((opt) => opt.setName('role').setDescription('Role to remove').setRequired(true)),
      )
      .addSubcommand((sub) =>
        sub
          .setName('humans')
          .setDescription('Mass assign a role to all human members.')
          .addRoleOption((opt) => opt.setName('role').setDescription('Role to assign').setRequired(true)),
      )
      .addSubcommand((sub) =>
        sub
          .setName('remove-humans')
          .setDescription('Mass remove a role from all human members.')
          .addRoleOption((opt) => opt.setName('role').setDescription('Role to remove').setRequired(true)),
      )
      .addSubcommand((sub) =>
        sub
          .setName('all')
          .setDescription('Mass assign a role to all server members.')
          .addRoleOption((opt) => opt.setName('role').setDescription('Role to assign').setRequired(true)),
      )
      .addSubcommand((sub) =>
        sub
          .setName('remove-all')
          .setDescription('Mass remove a role from all server members.')
          .addRoleOption((opt) => opt.setName('role').setDescription('Role to remove').setRequired(true)),
      ),
    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.inGuild() || !interaction.guild || !(interaction.member instanceof GuildMember)) {
        await interaction.reply({ content: '❌ Guild only.', ephemeral: true });
        return;
      }

      const sub = interaction.options.getSubcommand();
      const role = interaction.options.getRole('role', true) as Role;

      if (sub === 'info') {
        const memberCount = role.members.size;
        const embed = new EmbedBuilder()
          .setTitle(`🎭 Role Information: ${role.name}`)
          .setColor(role.color || 0x5865f2)
          .addFields(
            { name: 'Role ID', value: `\`${role.id}\``, inline: true },
            { name: 'Members', value: `${memberCount}`, inline: true },
            { name: 'Color', value: `#${role.color.toString(16).padStart(6, '0')}`, inline: true },
            { name: 'Position', value: `${role.position}`, inline: true },
            { name: 'Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true },
            { name: 'Hoisted', value: role.hoist ? 'Yes' : 'No', inline: true },
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
        return;
      }

      if (sub === 'add' || sub === 'remove') {
        const user = interaction.options.getUser('user', true);
        const targetMember = await interaction.guild.members.fetch(user.id).catch(() => null);
        if (!targetMember) {
          await interaction.reply({ content: '❌ Member not found in guild.', ephemeral: true });
          return;
        }

        try {
          await service.manageRole(targetMember, role, sub === 'add', interaction.member);
          await interaction.reply({
            content: `✅ Successfully ${sub === 'add' ? 'added' : 'removed'} **${role.name}** for <@${user.id}>.`,
          });
        } catch (err: unknown) {
          await interaction.reply({
            content: `❌ ${err instanceof Error ? err.message : String(err)}`,
            ephemeral: true,
          });
        }
        return;
      }

      // Mass role subcommands
      await interaction.deferReply();
      const isAdd = !sub.startsWith('remove-');
      const targetType = sub.includes('bots') ? 'bots' : sub.includes('humans') ? 'humans' : 'all';

      try {
        const count = await service.massRole(interaction.guild, role, targetType, isAdd, interaction.member);
        await interaction.editReply({
          content: `✅ Mass role executed: ${isAdd ? 'assigned' : 'removed'} **${role.name}** for **${count}** members.`,
        });
      } catch (err: unknown) {
        await interaction.editReply({
          content: `❌ ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    },
  };

  const nickCmd: CommandDefinition = {
    name: 'nick',
    description: 'Change or reset member server nickname.',
    data: new SlashCommandBuilder()
      .setName('nick')
      .setDescription('Set or reset server nickname for a member.')
      .addUserOption((opt) => opt.setName('user').setDescription('Target user').setRequired(true))
      .addStringOption((opt) => opt.setName('nickname').setDescription('New nickname (omit to reset)').setRequired(false))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),
    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({ content: '❌ Guild only.', ephemeral: true });
        return;
      }

      const user = interaction.options.getUser('user', true);
      const nickname = interaction.options.getString('nickname');
      const member = await interaction.guild.members.fetch(user.id).catch(() => null);

      if (!member) {
        await interaction.reply({ content: '❌ Member not found.', ephemeral: true });
        return;
      }

      try {
        await service.setNickname(member, nickname, interaction.user.tag);
        await interaction.reply({
          content: nickname
            ? `✅ Changed nickname for <@${user.id}> to **${nickname}**.`
            : `✅ Reset nickname for <@${user.id}>.`,
        });
      } catch (err: unknown) {
        await interaction.reply({
          content: `❌ Failed to update nickname: ${err instanceof Error ? err.message : String(err)}`,
          ephemeral: true,
        });
      }
    },
  };

  return [roleCmd, nickCmd];
}

