/**
 * /remove command — remove a track from the queue by its 1-based position.
 */

import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { Command } from './types.js';
import type { GuildPlayerManager } from '../player/guild-player.js';
import { canModifyQueue } from './helpers.js';

export const removeCommandData = new SlashCommandBuilder()
  .setName('remove')
  .setDescription('Remove a track from the queue by its position.')
  .addIntegerOption((opt) =>
    opt
      .setName('position')
      .setDescription('Track position in queue (1-based)')
      .setRequired(true)
      .setMinValue(1),
  );

export function makeRemoveCommand(playerManager: GuildPlayerManager): Command {
  return {
    data: removeCommandData,
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

      if (state.upcoming.length === 0) {
        await interaction.editReply('📭 The queue is empty.');
        return;
      }

      const position = interaction.options.getInteger('position', true);

      if (position < 1 || position > state.upcoming.length) {
        await interaction.editReply(
          `❌ Invalid track position. Please choose a number between 1 and ${state.upcoming.length}.`,
        );
        return;
      }

      try {
        const removed = playerManager.remove(guildId, position);
        const embed = new EmbedBuilder()
          .setTitle('🗑️ Track Removed')
          .setDescription(
            `Removed **[${removed.title}](${removed.uri ?? '#'})** from position **#${position}**.`,
          )
          .setColor(0x5865f2);

        await interaction.editReply({ embeds: [embed] });
      } catch (err) {
        await interaction.editReply(
          err instanceof Error ? `❌ Removal failed: ${err.message}` : '💥 Removal failed.',
        );
      }
    },
  };
}

