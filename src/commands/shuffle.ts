/**
 * /shuffle command — randomize upcoming tracks in the queue.
 */

import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { Command } from './types.js';
import type { GuildPlayerManager } from '../player/guild-player.js';
import { canModifyQueue } from './helpers.js';

export const shuffleCommandData = new SlashCommandBuilder()
  .setName('shuffle')
  .setDescription('Shuffle upcoming tracks in the queue.');

export function makeShuffleCommand(playerManager: GuildPlayerManager): Command {
  return {
    data: shuffleCommandData,
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

      if (state.upcoming.length < 2) {
        await interaction.editReply('🔀 Need at least 2 upcoming tracks in the queue to shuffle.');
        return;
      }

      playerManager.shuffle(guildId);

      const embed = new EmbedBuilder()
        .setTitle('🔀 Queue Shuffled')
        .setDescription(`Successfully randomized **${state.upcoming.length}** upcoming tracks.`)
        .setColor(0x5865f2);

      await interaction.editReply({ embeds: [embed] });
    },
  };
}

