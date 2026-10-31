/**
 * /leave command — disconnects from voice and clears queue.
 */

import { SlashCommandBuilder } from 'discord.js';
import type { Command } from './types.js';
import type { GuildPlayerManager } from '../player/guild-player.js';
import { RifflyError } from '../errors.js';
import { canModifyQueue } from './helpers.js';

export const leaveCommandData = new SlashCommandBuilder()
  .setName('leave')
  .setDescription('Disconnect from the voice channel and clear the queue.');

export function makeLeaveCommand(playerManager: GuildPlayerManager): Command {
  return {
    data: leaveCommandData,
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
        await playerManager.leave(guildId);
        await interaction.editReply('👋 Left the voice channel.');
      } catch (err) {
        const message = err instanceof RifflyError ? err.userMessage : '💥 Could not disconnect.';
        await interaction.editReply(message);
      }
    },
  };
}
