/**
 * /clear command — clear all upcoming tracks from the queue.
 */

import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { Command } from './types.js';
import type { GuildPlayerManager } from '../player/guild-player.js';
import { canModifyQueue } from './helpers.js';

export const clearCommandData = new SlashCommandBuilder()
  .setName('clear')
  .setDescription('Clear all upcoming tracks from the queue.');

export function makeClearCommand(playerManager: GuildPlayerManager): Command {
  return {
    data: clearCommandData,
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
      const state = playerManager.getState(guildId);
      const count = state.upcoming.length;

      if (count === 0) {
        await interaction.editReply('📭 The queue is already empty.');
        return;
      }

      playerManager.clear(guildId);

      const embed = new EmbedBuilder()
        .setTitle('🧹 Queue Cleared')
        .setDescription(`Cleared **${count}** upcoming track(s) from the queue.`)
        .setColor(0x5865f2);

      await interaction.editReply({ embeds: [embed] });
    },
  };
}
