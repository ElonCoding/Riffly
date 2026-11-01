/**
 * /backup slash commands for server template and structure preservation.
 */

import {
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { CommandDefinition } from '../core/types.js';
import type { BackupService } from './service.js';

export const backupCommandData = new SlashCommandBuilder()
  .setName('backup')
  .setDescription('Manage server backups and configuration snapshots.')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((sub) =>
    sub.setName('create').setDescription('Create a fresh structural backup of channels and roles.'),
  )
  .addSubcommand((sub) => sub.setName('list').setDescription('List available server snapshots.'));

export function createBackupCommands(backupService: BackupService): CommandDefinition[] {
  const backupCmd: CommandDefinition = {
    name: 'backup',
    description: 'Manage server backups and configuration snapshots.',
    data: backupCommandData,
    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({
          content: '❌ This command can only be used in a server.',
          ephemeral: true,
        });
        return;
      }

      const memberPerms = interaction.memberPermissions;
      if (!memberPerms?.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({
          content: '🔒 Administrator permission is required to manage server backups.',
          ephemeral: true,
        });
        return;
      }

      const sub = interaction.options.getSubcommand();

      if (sub === 'create') {
        await interaction.deferReply({ ephemeral: true });
        const snapshot = await backupService.createBackup(interaction.guild);

        const embed = new EmbedBuilder()
          .setTitle('💾 Server Backup Created')
          .setColor(0x57f287)
          .setDescription(
            `Successfully preserved structural snapshot for **${snapshot.guildName}**.\n\n` +
              `• **Backup ID:** \`${snapshot.id}\`\n` +
              `• **Roles Saved:** ${snapshot.roles.length}\n` +
              `• **Channels Saved:** ${snapshot.channels.length}\n` +
              `• **Timestamp:** <t:${Math.floor(new Date(snapshot.createdAt).getTime() / 1000)}:R>`,
          )
          .setFooter({ text: 'Riffly Server Preservation' });

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (sub === 'list') {
        const backups = await backupService.getBackups(interaction.guild.id);
        if (backups.length === 0) {
          await interaction.reply({
            content: '📂 No backups found for this server. Use `/backup create` to take one.',
            ephemeral: true,
          });
          return;
        }

        const lines = backups.map(
          (b, idx) =>
            `${idx + 1}. \`${b.id}\` — **${b.channels.length}** ch, **${b.roles.length}** roles (<t:${Math.floor(new Date(b.createdAt).getTime() / 1000)}:R>)`,
        );

        const embed = new EmbedBuilder()
          .setTitle(`📂 Server Backups (${backups.length})`)
          .setColor(0x5865f2)
          .setDescription(lines.join('\n'))
          .setFooter({ text: 'Riffly • Server Backups' });

        await interaction.reply({ embeds: [embed], ephemeral: true });
      }
    },
  };

  return [backupCmd];
}
