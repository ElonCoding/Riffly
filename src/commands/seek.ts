/**
 * /seek command — seek to a timestamp in the current track.
 */

import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { Command } from './types.js';
import type { GuildPlayerManager } from '../player/guild-player.js';
import { canModifyQueue, formatDuration, parseTimestamp } from './helpers.js';

export const seekCommandData = new SlashCommandBuilder()
  .setName('seek')
  .setDescription('Seek to a timestamp in the current track.')
  .addStringOption((opt) =>
    opt
      .setName('timestamp')
      .setDescription('Target timestamp (e.g. 1:30, 90s, 1m30s)')
      .setRequired(true),
  );

export function makeSeekCommand(playerManager: GuildPlayerManager): Command {
  return {
    data: seekCommandData,
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

      if (!state.current || state.engineState === 'idle' || state.engineState === 'disconnected') {
        await interaction.editReply('⏹️ Nothing is currently playing.');
        return;
      }

      if (state.current.isStream || !state.current.isSeekable) {
        await interaction.editReply('🚫 This track does not support seeking.');
        return;
      }

      const input = interaction.options.getString('timestamp', true);
      const positionMs = parseTimestamp(input);

      if (positionMs === null) {
        await interaction.editReply(
          '❌ Invalid timestamp format. Use e.g. `1:30`, `90s`, `1m30s`, or seconds.',
        );
        return;
      }

      if (positionMs > state.current.lengthMs) {
        await interaction.editReply(
          `❌ Seek position exceeds track duration (**${formatDuration(state.current.lengthMs)}**).`,
        );
        return;
      }

      try {
        await playerManager.seek(guildId, positionMs);
        const embed = new EmbedBuilder()
          .setTitle('⏩ Position Updated')
          .setDescription(
            `Seeked to **${formatDuration(positionMs)}** / **${formatDuration(state.current.lengthMs)}**.`,
          )
          .setColor(0x5865f2);

        await interaction.editReply({ embeds: [embed] });
      } catch (err) {
        await interaction.editReply(
          err instanceof Error ? `❌ Seek failed: ${err.message}` : '💥 Seek failed.',
        );
      }
    },
  };
}
