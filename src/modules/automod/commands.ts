import { EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { CommandDefinition } from '../core/types.js';
import type { AutoModService } from './service.js';
import type { AutoModSettings } from './types.js';

export function createAutoModCommands(
  _service: AutoModService,
  getSettingsFn?: (guildId: string, moduleId: string) => Promise<Record<string, unknown> | null>,
): CommandDefinition[] {
  const automodCommand: CommandDefinition = {
    name: 'automod',
    description: 'Configure and monitor server AutoMod filters.',
    data: new SlashCommandBuilder()
      .setName('automod')
      .setDescription('Configure and monitor server AutoMod filters.')
      .addSubcommand((sub) =>
        sub
          .setName('status')
          .setDescription('Displays the active configuration for Riffly AutoMod filters.'),
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    guildOnly: true,
    defaultMemberPermissions: PermissionFlagsBits.ManageGuild,
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: true });

      if (!interaction.guildId) {
        await interaction.editReply({ content: 'This command can only be used in a server.' });
        return;
      }

      const raw = await getSettingsFn?.(interaction.guildId, 'automod');
      const settings = (raw as AutoModSettings) ?? {
        enabled: true,
        antiInvite: true,
        antiLink: false,
        antiCaps: true,
        capsPercentage: 70,
        antiMentionSpam: true,
        maxMentions: 5,
        antiSpam: true,
        action: 'delete',
      };

      const embed = new EmbedBuilder()
        .setTitle('🛡️ Riffly AutoMod Status')
        .setColor(0x3b82f6)
        .setDescription('Server security and automated message moderation policies:')
        .addFields(
          {
            name: 'Core Status',
            value: settings.enabled !== false ? '✅ Enabled' : '❌ Disabled',
            inline: true,
          },
          {
            name: 'Action on Trigger',
            value: `\`${settings.action ?? 'delete'}\``,
            inline: true,
          },
          {
            name: 'Anti-Invite Link',
            value: settings.antiInvite ? '✅ Active' : '⚪ Inactive',
            inline: true,
          },
          {
            name: 'Anti-External Link',
            value: settings.antiLink ? '✅ Active' : '⚪ Inactive',
            inline: true,
          },
          {
            name: 'Anti-Caps Filter',
            value: settings.antiCaps
              ? `✅ Active (${settings.capsPercentage ?? 70}% limit)`
              : '⚪ Inactive',
            inline: true,
          },
          {
            name: 'Anti-Mention Spam',
            value: settings.antiMentionSpam
              ? `✅ Active (Max ${settings.maxMentions ?? 5})`
              : '⚪ Inactive',
            inline: true,
          },
          {
            name: 'Anti-Spam Rate Limit',
            value: settings.antiSpam ? '✅ Active (5 msgs / 5s)' : '⚪ Inactive',
            inline: true,
          },
        )
        .setFooter({ text: 'Riffly Server Security' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    },
  };

  return [automodCommand];
}
