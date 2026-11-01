/**
 * /filter command — apply DSP audio equalization presets.
 */

import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { Command } from './types.js';
import type { GuildPlayerManager } from '../player/guild-player.js';
import type { AudioFilterPreset } from '../audio/types.js';
import { canModifyQueue } from './helpers.js';

export const filterCommandData = new SlashCommandBuilder()
  .setName('filter')
  .setDescription('Apply audio equalization and DSP filter presets.')
  .addStringOption((opt) =>
    opt
      .setName('preset')
      .setDescription('Filter preset to activate')
      .setRequired(true)
      .addChoices(
        { name: 'Bassboost', value: 'bassboost' },
        { name: 'Nightcore', value: 'nightcore' },
        { name: 'Vaporwave', value: 'vaporwave' },
        { name: '8D Audio', value: '8d' },
        { name: 'Tremolo', value: 'tremolo' },
        { name: 'Karaoke', value: 'karaoke' },
        { name: 'Clear Filters', value: 'clear' },
      ),
  );

export function makeFilterCommand(playerManager: GuildPlayerManager): Command {
  return {
    data: filterCommandData,
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

      if (state.engineState === 'disconnected' || !state.current) {
        await interaction.editReply({
          content: '🔇 Nothing is currently playing.',
        });
        return;
      }

      const preset = interaction.options.getString('preset', true) as AudioFilterPreset;

      try {
        await playerManager.setFilter(guildId, preset);

        const embed = new EmbedBuilder()
          .setColor(0x6366f1)
          .setTitle('🎛️ Audio Filter Applied')
          .setDescription(
            preset === 'clear'
              ? '✅ Cleared all audio filters and restored flat equalization.'
              : `✅ Successfully activated **${preset.toUpperCase()}** audio preset.`,
          )
          .setFooter({ text: 'Riffly Audio Engine' })
          .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
      } catch (err: unknown) {
        await interaction.editReply({
          content: `❌ Failed to apply filter: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    },
  };
}

