/**
 * /nowplaying command
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { Command } from './types.js';
import type { GuildPlayerManager } from '../player/guild-player.js';

function formatDuration(ms: number): string {
  if (ms <= 0) return '∞';
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export const nowPlayingCommandData = new SlashCommandBuilder()
  .setName('nowplaying')
  .setDescription('Show what is currently playing.');

export function makeNowPlayingCommand(playerManager: GuildPlayerManager): Command {
  return {
    data: nowPlayingCommandData,
    async execute(interaction) {
      const guildId = interaction.guildId!;
      const state = playerManager.getState(guildId);

      if (!state.current || state.engineState === 'idle' || state.engineState === 'disconnected') {
        await interaction.reply({ content: '⏹️ Nothing is currently playing.', ephemeral: true });
        return;
      }

      const track = state.current;
      const embed = new EmbedBuilder()
        .setTitle('🎵 Now Playing')
        .setDescription(`**[${track.title}](${track.uri ?? '#'})**`)
        .addFields(
          { name: 'Artist', value: track.author, inline: true },
          {
            name: 'Duration',
            value: track.isStream ? '🔴 Live' : formatDuration(track.lengthMs),
            inline: true,
          },
          {
            name: 'Status',
            value: state.engineState === 'paused' ? '⏸️ Paused' : '▶️ Playing',
            inline: true,
          },
          {
            name: 'Loop',
            value:
              state.loopMode === 'off'
                ? 'Off'
                : state.loopMode === 'track'
                  ? '🔂 Track'
                  : '🔁 Queue',
            inline: true,
          },
          { name: 'Queue', value: `${state.upcoming.length} track(s) up next`, inline: true },
        )
        .setColor(0x5865f2);

      if (track.artworkUrl) {
        embed.setThumbnail(track.artworkUrl);
      }

      await interaction.reply({ embeds: [embed] });
    },
  };
}
