/**
 * Staff hierarchy management commands: /extraowner, /admin, /mod.
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { CommandDefinition } from './types.js';
import {
  ADMIN_DEFAULT_PERMISSIONS,
  ALL_PERMISSIONS_MASK,
  BotPermission,
  MOD_DEFAULT_PERMISSIONS,
  type StaffPermissionEngine,
} from './staff-permissions.js';

const PERMISSION_LABELS: Readonly<Record<number, string>> = {
  [BotPermission.BAN]: 'Ban (High Risk)',
  [BotPermission.UNBAN]: 'Unban (High Risk)',
  [BotPermission.KICK]: 'Kick (Standard)',
  [BotPermission.CHANNELUTILS]: 'Channelutils (Standard)',
  [BotPermission.WARN]: 'Warn & Modlogs (Standard)',
  [BotPermission.NICK]: 'Nickname (Standard)',
  [BotPermission.TIMEOUT]: 'Timeout / Mute (Standard)',
  [BotPermission.MANAGEROLES]: 'Manageroles (High Risk)',
  [BotPermission.PURGE]: 'Purge (Standard)',
  [BotPermission.SLOWMODE]: 'Slowmode (Standard)',
  [BotPermission.VCADMIN]: 'Vcadmin & Jail (High Risk)',
  [BotPermission.MANAGEEMOJIS]: 'Manage Emojis (Standard)',
};

export const extraOwnerCommandData = new SlashCommandBuilder()
  .setName('extraowner')
  .setDescription('Manage Riffly Extra Owners (Co-Owners with full bot access).')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((sub) =>
    sub
      .setName('add')
      .setDescription('Assign a member or role as Extra Owner.')
      .addUserOption((opt) => opt.setName('user').setDescription('Target user').setRequired(false))
      .addRoleOption((opt) => opt.setName('role').setDescription('Target role').setRequired(false)),
  )
  .addSubcommand((sub) =>
    sub
      .setName('remove')
      .setDescription('Revoke Extra Owner status from a member or role.')
      .addUserOption((opt) => opt.setName('user').setDescription('Target user').setRequired(false))
      .addRoleOption((opt) => opt.setName('role').setDescription('Target role').setRequired(false)),
  )
  .addSubcommand((sub) =>
    sub.setName('list').setDescription('List all configured Extra Owners in this server.'),
  );

export const adminCommandData = new SlashCommandBuilder()
  .setName('admin')
  .setDescription('Manage Server Administrators with custom 12-permission flags.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((sub) =>
    sub
      .setName('add')
      .setDescription('Assign Administrator permissions to a user or role.')
      .addUserOption((opt) => opt.setName('user').setDescription('Target user').setRequired(false))
      .addRoleOption((opt) => opt.setName('role').setDescription('Target role').setRequired(false)),
  )
  .addSubcommand((sub) =>
    sub
      .setName('edit')
      .setDescription('Modify Administrator permissions for a user or role.')
      .addUserOption((opt) => opt.setName('user').setDescription('Target user').setRequired(false))
      .addRoleOption((opt) => opt.setName('role').setDescription('Target role').setRequired(false)),
  )
  .addSubcommand((sub) =>
    sub
      .setName('remove')
      .setDescription('Revoke Administrator permissions from a user or role.')
      .addUserOption((opt) => opt.setName('user').setDescription('Target user').setRequired(false))
      .addRoleOption((opt) => opt.setName('role').setDescription('Target role').setRequired(false)),
  )
  .addSubcommand((sub) =>
    sub.setName('list').setDescription('List all Server Administrators and their active permissions.'),
  );

export const modCommandData = new SlashCommandBuilder()
  .setName('mod')
  .setDescription('Manage Server Moderators with safe baseline 12-permission flags.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((sub) =>
    sub
      .setName('add')
      .setDescription('Assign Moderator permissions to a user or role.')
      .addUserOption((opt) => opt.setName('user').setDescription('Target user').setRequired(false))
      .addRoleOption((opt) => opt.setName('role').setDescription('Target role').setRequired(false)),
  )
  .addSubcommand((sub) =>
    sub
      .setName('edit')
      .setDescription('Modify Moderator permissions for a user or role.')
      .addUserOption((opt) => opt.setName('user').setDescription('Target user').setRequired(false))
      .addRoleOption((opt) => opt.setName('role').setDescription('Target role').setRequired(false)),
  )
  .addSubcommand((sub) =>
    sub
      .setName('remove')
      .setDescription('Revoke Moderator permissions from a user or role.')
      .addUserOption((opt) => opt.setName('user').setDescription('Target user').setRequired(false))
      .addRoleOption((opt) => opt.setName('role').setDescription('Target role').setRequired(false)),
  )
  .addSubcommand((sub) =>
    sub.setName('list').setDescription('List all Server Moderators and their active permissions.'),
  );

export function buildStaffPermissionEmbed(
  targetName: string,
  tier: 'admin' | 'mod',
  mask: number,
  executorTag: string,
): EmbedBuilder {
  const lines: string[] = [];
  for (let i = 0; i < 12; i++) {
    const flag = 1 << i;
    const granted = (mask & flag) !== 0;
    const label = PERMISSION_LABELS[flag] ?? `Perm ${i}`;
    lines.push(`${granted ? '✅' : '❌'} **${label}**`);
  }

  return new EmbedBuilder()
    .setTitle(`🛡️ Staff Permission Panel • ${tier.toUpperCase()}`)
    .setColor(tier === 'admin' ? 0x9b59b6 : 0x3498db)
    .setDescription(
      `**Target:** ${targetName}\n` +
        `**Tier:** ${tier === 'admin' ? 'Server Administrator' : 'Server Moderator'}\n` +
        `**Configured by:** ${executorTag}\n\n` +
        lines.join('\n'),
    )
    .setFooter({ text: 'Riffly • 4-Tier Staff Hierarchy' })
    .setTimestamp();
}

export function buildPermissionComponents(
  tier: 'admin' | 'mod',
  currentMask: number,
): [ActionRowBuilder<StringSelectMenuBuilder>, ActionRowBuilder<ButtonBuilder>] {
  const options = Object.entries(PERMISSION_LABELS).map(([bitStr, label]) => {
    const bit = parseInt(bitStr, 10);
    return {
      label,
      value: bitStr,
      default: (currentMask & bit) === bit,
    };
  });

  const select = new StringSelectMenuBuilder()
    .setCustomId(`riffly_perm_select_${tier}`)
    .setPlaceholder('Select active permissions')
    .setMinValues(0)
    .setMaxValues(options.length)
    .addOptions(options);

  const btnAll = new ButtonBuilder()
    .setCustomId(`riffly_perm_all_${tier}`)
    .setLabel('Grant All Permissions')
    .setStyle(ButtonStyle.Primary);

  const btnSave = new ButtonBuilder()
    .setCustomId(`riffly_perm_save_${tier}`)
    .setLabel('Save')
    .setStyle(ButtonStyle.Success);

  const btnCancel = new ButtonBuilder()
    .setCustomId(`riffly_perm_cancel_${tier}`)
    .setLabel('Cancel')
    .setStyle(ButtonStyle.Danger);

  const row1 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(btnAll, btnSave, btnCancel);

  return [row1, row2];
}

export function createStaffCommands(engine: StaffPermissionEngine): CommandDefinition[] {
  const extraOwnerCmd: CommandDefinition = {
    name: 'extraowner',
    description: 'Manage Riffly Extra Owners (Co-Owners with full bot access).',
    data: extraOwnerCommandData,
    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({ content: '❌ Guild only.', ephemeral: true });
        return;
      }
      if (
        interaction.guild.ownerId !== interaction.user.id &&
        !engine.isGlobalOwner(interaction.user.id)
      ) {
        await interaction.reply({
          content: '🔒 Only the Server Owner or Global Bot Owner can manage Extra Owners.',
          ephemeral: true,
        });
        return;
      }

      const sub = interaction.options.getSubcommand();
      const user = interaction.options.getUser('user');
      const role = interaction.options.getRole('role');

      if (sub === 'add') {
        const targetId = user?.id ?? role?.id;
        const targetType = user ? 'user' : 'role';
        if (!targetId) {
          await interaction.reply({ content: '❌ Must provide user or role.', ephemeral: true });
          return;
        }

        await engine.addOrUpdateStaff(interaction.guild.id, {
          targetId,
          targetType,
          tier: 'extraowner',
          permissions: ALL_PERMISSIONS_MASK,
        });

        await interaction.reply({
          content: `✅ Granted Extra Owner privileges to **${user?.username ?? role?.name}**.`,
        });
        return;
      }

      if (sub === 'remove') {
        const targetId = user?.id ?? role?.id;
        if (!targetId) {
          await interaction.reply({ content: '❌ Must provide user or role.', ephemeral: true });
          return;
        }

        const removed = await engine.removeStaff(interaction.guild.id, targetId);
        await interaction.reply({
          content: removed
            ? `✅ Removed Extra Owner access from **${user?.username ?? role?.name}**.`
            : '⚠️ Entity was not configured as an Extra Owner.',
          ephemeral: true,
        });
        return;
      }

      if (sub === 'list') {
        const staff = await engine.getStaffList(interaction.guild.id);
        const extraOwners = staff.filter((s) => s.tier === 'extraowner');
        if (extraOwners.length === 0) {
          await interaction.reply({ content: '📂 No Extra Owners configured.', ephemeral: true });
          return;
        }

        const lines = extraOwners.map(
          (s) => `• ${s.targetType === 'user' ? `<@${s.targetId}>` : `<@&${s.targetId}>`}`,
        );

        const embed = new EmbedBuilder()
          .setTitle('👑 Riffly Extra Owners (Co-Owners)')
          .setColor(0xf1c40f)
          .setDescription(lines.join('\n'))
          .setFooter({ text: 'Full Bot Administrative Access' });

        await interaction.reply({ embeds: [embed] });
      }
    },
  };

  const createTierCommand = (
    tier: 'admin' | 'mod',
    data: SlashCommandBuilder | ReturnType<SlashCommandBuilder['addSubcommand']>,
  ): CommandDefinition => ({
    name: tier,
    description: `Manage Server ${tier === 'admin' ? 'Administrators' : 'Moderators'}.`,
    data,
    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({ content: '❌ Guild only.', ephemeral: true });
        return;
      }

      // Check if executor is Owner or Extra Owner
      const isOwner = interaction.guild.ownerId === interaction.user.id;
      const staffList = await engine.getStaffList(interaction.guild.id);
      const isExtraOwner = staffList.some(
        (s) => s.tier === 'extraowner' && s.targetId === interaction.user.id,
      );

      if (!isOwner && !isExtraOwner && !engine.isGlobalOwner(interaction.user.id)) {
        await interaction.reply({
          content: '🔒 Only Server Owner or Extra Owners can configure staff permissions.',
          ephemeral: true,
        });
        return;
      }

      const sub = interaction.options.getSubcommand();
      const user = interaction.options.getUser('user');
      const role = interaction.options.getRole('role');

      if (sub === 'add' || sub === 'edit') {
        const targetId = user?.id ?? role?.id;
        const targetName = user?.username ?? role?.name ?? 'Target';
        const targetType = user ? 'user' : 'role';
        if (!targetId) {
          await interaction.reply({ content: '❌ Must provide user or role.', ephemeral: true });
          return;
        }

        const defaultMask =
          tier === 'admin' ? ADMIN_DEFAULT_PERMISSIONS : MOD_DEFAULT_PERMISSIONS;
        const existing = staffList.find((s) => s.targetId === targetId && s.tier === tier);
        const activeMask = existing ? existing.permissions : defaultMask;

        await engine.addOrUpdateStaff(interaction.guild.id, {
          targetId,
          targetType,
          tier,
          permissions: activeMask,
        });

        const embed = buildStaffPermissionEmbed(
          targetName,
          tier,
          activeMask,
          interaction.user.tag,
        );
        const components = buildPermissionComponents(tier, activeMask);

        await interaction.reply({
          embeds: [embed],
          components,
        });
        return;
      }

      if (sub === 'remove') {
        const targetId = user?.id ?? role?.id;
        if (!targetId) {
          await interaction.reply({ content: '❌ Must provide user or role.', ephemeral: true });
          return;
        }

        const removed = await engine.removeStaff(interaction.guild.id, targetId);
        await interaction.reply({
          content: removed
            ? `✅ Revoked ${tier.toUpperCase()} status from **${user?.username ?? role?.name}**.`
            : '⚠️ Entity was not found in staff registry.',
          ephemeral: true,
        });
        return;
      }

      if (sub === 'list') {
        const staff = await engine.getStaffList(interaction.guild.id);
        const filtered = staff.filter((s) => s.tier === tier);
        if (filtered.length === 0) {
          await interaction.reply({
            content: `📂 No Server ${tier === 'admin' ? 'Administrators' : 'Moderators'} configured.`,
            ephemeral: true,
          });
          return;
        }

        const lines = filtered.map(
          (s) =>
            `• ${s.targetType === 'user' ? `<@${s.targetId}>` : `<@&${s.targetId}>`} — Perms: \`${s.permissions.toString(2).padStart(12, '0')}\``,
        );

        const embed = new EmbedBuilder()
          .setTitle(`🛡️ Server ${tier === 'admin' ? 'Administrators' : 'Moderators'}`)
          .setColor(tier === 'admin' ? 0x9b59b6 : 0x3498db)
          .setDescription(lines.join('\n'));

        await interaction.reply({ embeds: [embed] });
      }
    },
  });

  return [
    extraOwnerCmd,
    createTierCommand('admin', adminCommandData),
    createTierCommand('mod', modCommandData),
  ];
}
