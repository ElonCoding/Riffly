/**
 * /nowplaying command — display currently playing track with interactive controls and dynamic progress bar.
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import type { Command } from './types.js';
import type { GuildPlayerManager } from '../player/guild-player.js';
import { createProgressBar, formatDuration } from './helpers.js';

export const nowPlayingCommandData = new SlashCommandBuilder()
  .setName('nowplaying')
  .setDescription('Show what is currently playing.');

export function makeNowPlayingCommand(playerManager: GuildPlayerManager): Command {
  return {
    data: nowPlayingCommandData,
    async execute(interaction) {
      if (!interaction.inGuild() || !interaction.guildId) {
        await interaction.reply({
          content: '❌ This command can only be used in a server.',
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

      const track = state.current;
      const positionMs =
        typeof playerManager.getPlaybackPosition === 'function'
          ? playerManager.getPlaybackPosition(guildId)
          : 0;

      const volume =
        typeof playerManager.getVolume === 'function' ? playerManager.getVolume(guildId) : 100;

      const progressBar = track.isStream
        ? '🔴 Live Stream'
        : createProgressBar(positionMs, track.lengthMs);

      const loopDisplay =
        state.loopMode === 'off'
          ? 'Off'
          : state.loopMode === 'track'
            ? '🔂 Track'
            : '🔁 Queue';

      const embed = new EmbedBuilder()
        .setTitle('🎵 Now Playing')
        .setDescription(`**[${track.title}](${track.uri ?? '#'})**\n\n${progressBar}`)
        .addFields(
          { name: 'Artist', value: track.author, inline: true },
          {
            name: 'Duration',
            value: track.isStream ? '🔴 Live' : formatDuration(track.lengthMs, true),
            inline: true,
          },
          {
            name: 'Requested By',
            value: track.requesterId ? `<@${track.requesterId}>` : 'Unknown',
            inline: true,
          },
          {
            name: 'Status',
            value: state.engineState === 'paused' ? '⏸️ Paused' : '▶️ Playing',
            inline: true,
          },
          { name: 'Volume', value: `🔊 ${volume}%`, inline: true },
          { name: 'Loop', value: loopDisplay, inline: true },
          { name: 'Queue', value: `${state.upcoming.length} track(s) up next`, inline: true },
        )
        .setColor(0x5865f2);

      if (track.artworkUrl) {
        embed.setThumbnail(track.artworkUrl);
      }

      const isPaused = state.engineState === 'paused';
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('riffly_pause')
          .setLabel('Pause')
          .setEmoji('⏸️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(isPaused),
        new ButtonBuilder()
          .setCustomId('riffly_resume')
          .setLabel('Resume')
          .setEmoji('▶️')
          .setStyle(ButtonStyle.Success)
          .setDisabled(!isPaused),
        new ButtonBuilder()
          .setCustomId('riffly_skip')
          .setLabel('Skip')
          .setEmoji('⏭️')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('riffly_stop')
          .setLabel('Stop')
          .setEmoji('⏹️')
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId('riffly_loop')
          .setLabel(
            state.loopMode === 'track'
              ? 'Loop Track'
              : state.loopMode === 'queue'
                ? 'Loop Queue'
                : 'Loop',
          )
          .setEmoji(state.loopMode === 'track' ? '🔂' : '🔁')
          .setStyle(state.loopMode === 'off' ? ButtonStyle.Secondary : ButtonStyle.Primary),
      );

      await interaction.editReply({ embeds: [embed], components: [row] });
    },
  };
}
