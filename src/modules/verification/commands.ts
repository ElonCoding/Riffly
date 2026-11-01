import {
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import type { TextChannel } from 'discord.js';
import type { CommandDefinition } from '../core/types.js';
import type { VerificationService } from './service.js';

export function createVerificationCommands(service: VerificationService): CommandDefinition[] {
  const verifyCommand: CommandDefinition = {
    name: 'verification',
    description: 'Configure and post verification panels.',
    data: new SlashCommandBuilder()
      .setName('verification')
      .setDescription('Configure and post verification panels.')
      .addSubcommand((sub) =>
        sub
          .setName('panel')
          .setDescription('Post the verification panel in this channel.')
          .addStringOption((opt) =>
            opt.setName('title').setDescription('Panel title').setRequired(false),
          )
          .addStringOption((opt) =>
            opt.setName('description').setDescription('Panel description').setRequired(false),
          ),
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    guildOnly: true,
    defaultMemberPermissions: PermissionFlagsBits.Administrator,
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: true });
      const channel = interaction.channel;

      if (!channel || !('guild' in channel) || typeof (channel as TextChannel).send !== 'function') {
        await interaction.editReply({ content: 'Must be run in a text channel.' });
        return;
      }

      const subcommand = interaction.options.getSubcommand();
      if (subcommand === 'panel') {
        const title = interaction.options.getString('title') ?? undefined;
        const description = interaction.options.getString('description') ?? undefined;

        try {
          await service.sendVerificationPanel(channel as TextChannel, title, description);
          await interaction.editReply({ content: '✅ Verification panel posted successfully!' });
        } catch (err: unknown) {
          await interaction.editReply({
            content: `Failed to post verification panel: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      }
    },
  };

  return [verifyCommand];
}
