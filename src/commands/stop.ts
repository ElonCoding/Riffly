/**
 * /stop command — clears queue and stops playback.
 */

import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { Command } from './types.js';
import type { GuildPlayerManager } from '../player/guild-player.js';
import { RifflyError } from '../errors.js';
import { canModifyQueue } from './helpers.js';

export const stopCommandData = new SlashCommandBuilder()
  .setName('stop')
  .setDescription('Stop playback and clear the queue.');

export function makeStopCommand(playerManager: GuildPlayerManager): Command {
  return {
    data: stopCommandData,
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

      await interaction.deferReply();

      const guildId = interaction.guildId;
      try {
        await playerManager.stop(guildId);
        const embed = new EmbedBuilder()
          .setTitle('⏹️ Stopped')
          .setDescription('Playback stopped and the queue has been cleared.')
          .setColor(0x5865f2);
        await interaction.editReply({ embeds: [embed] });
      } catch (err) {
        const message = err instanceof RifflyError ? err.userMessage : '💥 Could not stop.';
        await interaction.editReply(message);
      }
    },
  };
}
