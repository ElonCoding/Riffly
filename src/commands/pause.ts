/**
 * /pause command
 */

import { SlashCommandBuilder } from 'discord.js';
import type { Command } from './types.js';
import type { GuildPlayerManager } from '../player/guild-player.js';
import { RifflyError } from '../errors.js';

export const pauseCommandData = new SlashCommandBuilder()
  .setName('pause')
  .setDescription('Pause playback.');

export function makePauseCommand(playerManager: GuildPlayerManager): Command {
  return {
    data: pauseCommandData,
    async execute(interaction) {
      const guildId = interaction.guildId!;
      try {
        await playerManager.pause(guildId);
        await interaction.reply('⏸️ Paused.');
      } catch (err) {
        const message = err instanceof RifflyError ? err.userMessage : '💥 Could not pause.';
        await interaction.reply({ content: message, ephemeral: true });
      }
    },
  };
}
