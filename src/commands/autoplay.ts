/**
 * /autoplay command — toggle smart recommendations when the queue finishes.
 */

import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { Command } from './types.js';
import type { GuildPlayerManager } from '../player/guild-player.js';
import { canModifyQueue } from './helpers.js';

export const autoplayCommandData = new SlashCommandBuilder()
  .setName('autoplay')
  .setDescription('Automatically enqueue related music tracks when the queue ends.')
  .addBooleanOption((opt) =>
    opt
      .setName('enabled')
      .setDescription('Enable or disable autoplay mode (toggles if omitted)')
      .setRequired(false),
  );

export function makeAutoplayCommand(playerManager: GuildPlayerManager): Command {
  return {
    data: autoplayCommandData,
    async execute(interaction) {
      if (!interaction.inGuild() || !interaction.guildId) {
        await interaction.reply({
          content: '❌ This command can only be used in a server.',
          ephemeral: true,
        });
        return;
      }

      if (!canModifyQueue(interaction)) {
        await interaction.reply({
          content: '🔇 You must be in the same voice channel as Riffly to use this command.',
          ephemeral: true,
        });
        return;
      }

      const explicitState = interaction.options.getBoolean('enabled');
      const newState =
        explicitState !== null
          ? (playerManager.setAutoplay(interaction.guildId, explicitState), explicitState)
          : playerManager.toggleAutoplay(interaction.guildId);

      const embed = new EmbedBuilder()
        .setTitle('📻 Riffly Autoplay')
        .setColor(newState ? 0x2ecc71 : 0xe74c3c)
        .setDescription(
          newState
            ? '✅ **Autoplay has been enabled.** Riffly will automatically queue similar recommendations when current tracks finish.'
            : '⏸️ **Autoplay has been disabled.** Playback will stop when the queue finishes.',
        )
        .setFooter({ text: 'Riffly • Seamless Audio System' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    },
  };
}
