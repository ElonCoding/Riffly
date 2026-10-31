/**
 * /pause command
 */

import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { Command } from './types.js';
import type { GuildPlayerManager } from '../player/guild-player.js';
import { RifflyError } from '../errors.js';
import { canModifyQueue } from './helpers.js';

export const pauseCommandData = new SlashCommandBuilder()
  .setName('pause')
  .setDescription('Pause playback.');

export function makePauseCommand(playerManager: GuildPlayerManager): Command {
  return {
    data: pauseCommandData,
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
        await playerManager.pause(guildId);
        const embed = new EmbedBuilder()
          .setTitle('⏸️ Paused')
          .setDescription('Playback has been paused.')
          .setColor(0x5865f2);
        await interaction.editReply({ embeds: [embed] });
      } catch (err) {
        let message: string;
        if (err instanceof RifflyError) {
          message = err.userMessage;
        } else if (err instanceof Error && err.message.toLowerCase().includes('already paused')) {
          message = RifflyError.alreadyPaused().userMessage;
        } else {
          message = '💥 Could not pause playback.';
        }
        await interaction.editReply(message);
      }
    },
  };
}
