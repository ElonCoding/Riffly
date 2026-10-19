/**
 * /leave command — disconnects from voice and clears queue.
 */

import { SlashCommandBuilder } from 'discord.js';
import type { Command } from './types.js';
import type { GuildPlayerManager } from '../player/guild-player.js';
import { RifflyError } from '../errors.js';

export function makeLeaveCommand(playerManager: GuildPlayerManager): Command {
  return {
    data: new SlashCommandBuilder()
      .setName('leave')
      .setDescription('Disconnect from the voice channel and clear the queue.'),
    async execute(interaction) {
      const guildId = interaction.guildId!;
      try {
        await playerManager.leave(guildId);
        await interaction.reply('👋 Left the voice channel.');
      } catch (err) {
        const message = err instanceof RifflyError ? err.userMessage : '💥 Could not disconnect.';
        await interaction.reply({ content: message, ephemeral: true });
      }
    },
  };
}
