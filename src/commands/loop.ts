/**
 * /loop command — set loop mode (off, track, queue).
 */

import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { Command } from './types.js';
import type { GuildPlayerManager } from '../player/guild-player.js';
import type { LoopMode } from '../player/queue.js';
import { canModifyQueue } from './helpers.js';

export const loopCommandData = new SlashCommandBuilder()
  .setName('loop')
  .setDescription('Set the playback loop mode.')
  .addStringOption((opt) =>
    opt
      .setName('mode')
      .setDescription('Loop mode to set')
      .setRequired(true)
      .addChoices(
        { name: 'Off', value: 'off' },
        { name: 'Track', value: 'track' },
        { name: 'Queue', value: 'queue' },
      ),
  );

export function makeLoopCommand(playerManager: GuildPlayerManager): Command {
  return {
    data: loopCommandData,
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

      if (state.engineState === 'disconnected' || (!state.current && state.upcoming.length === 0)) {
        await interaction.editReply('⏹️ Nothing is currently playing.');
        return;
      }

      const mode = interaction.options.getString('mode', true) as LoopMode;
      playerManager.setLoopMode(guildId, mode);

      const modeLabels: Record<LoopMode, { emoji: string; label: string }> = {
        off: { emoji: '➡️', label: 'Off' },
        track: { emoji: '🔂', label: 'Track' },
        queue: { emoji: '🔁', label: 'Queue' },
      };

      const info = modeLabels[mode] ?? { emoji: '🔁', label: mode };
      const embed = new EmbedBuilder()
        .setTitle(`${info.emoji} Loop Mode Updated`)
        .setDescription(`Loop mode has been set to **${info.label}**.`)
        .setColor(0x5865f2);

      await interaction.editReply({ embeds: [embed] });
    },
  };
}

