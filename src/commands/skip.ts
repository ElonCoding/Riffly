/**
 * /skip command
 */

import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { Command } from './types.js';
import type { GuildPlayerManager } from '../player/guild-player.js';
import { RifflyError } from '../errors.js';
import { canModifyQueue } from './helpers.js';

export const skipCommandData = new SlashCommandBuilder()
  .setName('skip')
  .setDescription('Skip the current track.');

export function makeSkipCommand(playerManager: GuildPlayerManager): Command {
  return {
    data: skipCommandData,
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
        const next = await playerManager.skip(guildId);
        const embed = new EmbedBuilder()
          .setTitle('⏭️ Skipped')
          .setDescription(
            next
              ? `Now playing: **${next.title}** by ${next.author}`
              : 'Queue is now empty.',
          )
          .setColor(0x5865f2);

        if (next?.artworkUrl) {
          embed.setThumbnail(next.artworkUrl);
        }
        await interaction.editReply({ embeds: [embed] });
      } catch (err) {
        const message = err instanceof RifflyError ? err.userMessage : '💥 Could not skip.';
        await interaction.editReply(message);
      }
    },
  };
}
