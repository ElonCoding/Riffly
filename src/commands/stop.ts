/**
 * /stop command — clears queue and stops playback.
 */

import { SlashCommandBuilder } from 'discord.js';
import type { Command } from './types.js';
import type { GuildPlayerManager } from '../player/guild-player.js';
import { RifflyError } from '../errors.js';

export const stopCommandData = new SlashCommandBuilder()
  .setName('stop')
  .setDescription('Stop playback and clear the queue.');

export function makeStopCommand(playerManager: GuildPlayerManager): Command {
  return {
    data: stopCommandData,
    async execute(interaction) {
      const guildId = interaction.guildId!;
      try {
        await playerManager.stop(guildId);
        await interaction.reply('⏹️ Stopped and queue cleared.');
      } catch (err) {
        const message = err instanceof RifflyError ? err.userMessage : '💥 Could not stop.';
        await interaction.reply({ content: message, ephemeral: true });
      }
    },
  };
}
