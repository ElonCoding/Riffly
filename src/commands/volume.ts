/**
 * /volume command — view or adjust playback volume (0-100%).
 */

import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { Command } from './types.js';
import type { GuildPlayerManager } from '../player/guild-player.js';
import { canModifyQueue } from './helpers.js';

export const volumeCommandData = new SlashCommandBuilder()
  .setName('volume')
  .setDescription('View or change playback volume.')
  .addIntegerOption((opt) =>
    opt
      .setName('percent')
      .setDescription('Volume level from 0 to 100')
      .setRequired(false)
      .setMinValue(0)
      .setMaxValue(100),
  );

export function makeVolumeCommand(playerManager: GuildPlayerManager): Command {
  return {
    data: volumeCommandData,
    async execute(interaction) {
      if (!interaction.inGuild() || !interaction.guildId) {
        await interaction.reply({
          content: '❌ This command can only be used in a server.',
          ephemeral: true,
        });
        return;
      }

      const guildId = interaction.guildId;
      const percent = interaction.options.getInteger('percent');

      // If no percent provided, display current volume
      if (percent === null) {
        const currentVolume =
          typeof playerManager.getVolume === 'function' ? playerManager.getVolume(guildId) : 100;

        const embed = new EmbedBuilder()
          .setTitle('🔊 Volume')
          .setDescription(`Current playback volume is **${currentVolume}%**.`)
          .setColor(0x5865f2);

        await interaction.reply({ embeds: [embed] });
        return;
      }

      // Check voice channel co-location
      if (!canModifyQueue(interaction)) {
        await interaction.reply({
          content: '🔇 You must be in the same voice channel as Riffly to use this command.',
          ephemeral: true,
        });
        return;
      }

      await interaction.deferReply();

      try {
        await playerManager.setVolume(guildId, percent);
        const embed = new EmbedBuilder()
          .setTitle('🔊 Volume Updated')
          .setDescription(`Playback volume set to **${percent}%**.`)
          .setColor(0x5865f2);

        await interaction.editReply({ embeds: [embed] });
      } catch (err) {
        await interaction.editReply(
          err instanceof Error ? `❌ Could not set volume: ${err.message}` : '💥 Could not set volume.',
        );
      }
    },
  };
}

