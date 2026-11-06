/**
 * /nowplaying command — display currently playing track with interactive controls and dynamic progress bar.
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
} from 'discord.js';
import type { Command } from './types.js';
import type { GuildPlayerManager, GuildPlayerState } from '../player/guild-player.js';
import type { Track } from '../audio/types.js';
import { createMusicSlider, formatDuration } from './helpers.js';

export const nowPlayingCommandData = new SlashCommandBuilder()
  .setName('nowplaying')
  .setDescription('Show what is currently playing with live audio visualizer and controls.');

export function buildNowPlayingEmbeds(
  state: GuildPlayerState,
  positionMs: number,
  clientPing = 0,
  currentVolume?: number,
): [EmbedBuilder, EmbedBuilder] {
  const track = state.current!;
  const isPaused = state.engineState === 'paused';
  const volume = typeof currentVolume === 'number' ? currentVolume : (typeof state.volume === 'number' ? state.volume : 100);
  const loopStr =
    state.loopMode === 'off' ? 'Off' : state.loopMode === 'track' ? 'Track' : 'Queue';
  const ping = Math.max(0, Math.round(clientPing || 0));

  const curStr = formatDuration(Math.max(0, positionMs), true);
  const totStr = track.isStream ? 'LIVE' : formatDuration(track.lengthMs, true);
  const visualizerIcon = isPaused ? '⏸️' : 'ılı';
  const slider = createMusicSlider(positionMs, track.lengthMs, 16);

  const nowPlayingEmbed = new EmbedBuilder()
    .setTitle('Now Playing')
    .setDescription(
      `${visualizerIcon} | **[${track.title}](${track.uri ?? '#'})** by ${track.author}\n\n` +
        `\`${curStr}\` ${slider}\n` +
        `\`${totStr}\`\n\n` +
        `Volume: ${volume}% · Repeat: ${loopStr} · Ping: ${ping}ms`,
    )
    .setColor(0x2b2d31);

  if (track.artworkUrl) {
    nowPlayingEmbed.setThumbnail(track.artworkUrl);
  }

  // Up Next Embed
  const upcoming = state.upcoming;
  let upNextDescription = '';
  if (upcoming.length > 0) {
    const preview = upcoming.slice(0, 3);
    const lines = preview.map(
      (t, i) => `${i + 1}. **[${t.title}](${t.uri ?? '#'})** by ${t.author}`,
    );
    if (upcoming.length > 3) {
      lines.push(`... and ${upcoming.length - 3} more track(s)`);
    }
    upNextDescription = lines.join('\n');
  } else {
    upNextDescription = 'Nothing next in queue. Use `/play` to add more!';
  }

  const upNextEmbed = new EmbedBuilder()
    .setTitle('Up Next')
    .setDescription(upNextDescription)
    .setColor(0x2b2d31);

  return [nowPlayingEmbed, upNextEmbed];
}

export function buildMusicControlRows(
  isPaused: boolean,
  _loopMode: 'off' | 'track' | 'queue' = 'off',
  _queueCount = 0,
  upcomingTracks: readonly Track[] = [],
): ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>[] {
  const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('riffly_resume')
      .setEmoji('▶️')
      .setStyle(isPaused ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setDisabled(!isPaused),
    new ButtonBuilder()
      .setCustomId('riffly_previous')
      .setEmoji('⏮️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('riffly_pause')
      .setEmoji('⏸️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(isPaused),
    new ButtonBuilder()
      .setCustomId('riffly_skip')
      .setEmoji('⏭️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('riffly_like')
      .setEmoji('❤️')
      .setStyle(ButtonStyle.Secondary),
  );

  const selectOptions = upcomingTracks.slice(0, 25).map((t, idx) => ({
    label: `${idx + 1}. ${t.title}`.slice(0, 100),
    description: `by ${t.author} · ${formatDuration(t.lengthMs, true)}`.slice(0, 100),
    value: `skip_to_${idx}`,
  }));

  const queueSelectMenu = new StringSelectMenuBuilder()
    .setCustomId('riffly_queue_select')
    .setPlaceholder('Select a track to skip, move or remove');

  if (selectOptions.length > 0) {
    queueSelectMenu.addOptions(selectOptions);
  } else {
    queueSelectMenu.addOptions([
      {
        label: 'Queue is empty',
        description: 'Add more songs with /play',
        value: 'queue_empty',
      },
    ]);
    queueSelectMenu.setDisabled(true);
  }

  const queueRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(queueSelectMenu);

  const featuresSelectMenu = new StringSelectMenuBuilder()
    .setCustomId('riffly_more_features')
    .setPlaceholder('More Features...')
    .addOptions([
      {
        label: 'Shuffle Queue',
        description: 'Randomize the upcoming queue order',
        emoji: '🔀',
        value: 'feature_shuffle',
      },
      {
        label: 'Loop Track',
        description: 'Repeat the currently playing track',
        emoji: '🔂',
        value: 'feature_loop_track',
      },
      {
        label: 'Loop Queue',
        description: 'Repeat the entire playlist queue',
        emoji: '🔁',
        value: 'feature_loop_queue',
      },
      {
        label: 'Loop Off',
        description: 'Turn off repeat loop mode',
        emoji: '➡️',
        value: 'feature_loop_off',
      },
      {
        label: 'Clear Queue',
        description: 'Remove all upcoming songs from queue',
        emoji: '🗑️',
        value: 'feature_clear',
      },
      {
        label: 'Autoplay',
        description: 'Toggle automatic recommendation playback',
        emoji: '📻',
        value: 'feature_autoplay',
      },
      {
        label: 'Bass Boost',
        description: 'Deep resonant bass boost audio filter',
        emoji: '🔊',
        value: 'feature_bassboost',
      },
      {
        label: 'Nightcore',
        description: 'Fast tempo and high pitch nightcore filter',
        emoji: '🌙',
        value: 'feature_nightcore',
      },
      {
        label: '8D Spatial Audio',
        description: 'Rotating 3D surround sound audio filter',
        emoji: '🎧',
        value: 'feature_8d',
      },
      {
        label: 'Vaporwave',
        description: 'Slowed aesthetic reverb audio filter',
        emoji: '🌊',
        value: 'feature_vaporwave',
      },
      {
        label: 'Show Lyrics',
        description: 'Find lyrics for the current song',
        emoji: '📜',
        value: 'feature_lyrics',
      },
    ]);

  const featuresRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(featuresSelectMenu);

  return [buttonRow, queueRow, featuresRow];
}

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

      const positionMs =
        typeof playerManager.getPlaybackPosition === 'function'
          ? playerManager.getPlaybackPosition(guildId)
          : 0;

      const volume =
        typeof playerManager.getVolume === 'function' ? playerManager.getVolume(guildId) : 100;

      const clientPing = (interaction.client as unknown as { ws?: { ping?: number } })?.ws?.ping ?? 0;
      const [nowPlayingEmbed, upNextEmbed] = buildNowPlayingEmbeds(state, positionMs, clientPing, volume);

      const rows = buildMusicControlRows(
        state.engineState === 'paused',
        state.loopMode,
        state.upcoming.length,
        state.upcoming,
      );

      await interaction.editReply({ embeds: [nowPlayingEmbed, upNextEmbed], components: rows });

      // Live ticker to update visualizer & progress bar continuously
      let tickCount = 0;
      const interval = setInterval(async () => {
        tickCount++;
        if (tickCount > 100) {
          clearInterval(interval);
          return;
        }
        try {
          const currentState = playerManager.getState(guildId);
          if (
            !currentState.current ||
            currentState.engineState === 'idle' ||
            currentState.engineState === 'disconnected'
          ) {
            clearInterval(interval);
            return;
          }
          const livePos =
            typeof playerManager.getPlaybackPosition === 'function'
              ? playerManager.getPlaybackPosition(guildId)
              : 0;

          const livePing = (interaction.client as unknown as { ws?: { ping?: number } })?.ws?.ping ?? 0;
          const liveVol =
            typeof playerManager.getVolume === 'function' ? playerManager.getVolume(guildId) : 100;
          const [updatedNow, updatedNext] = buildNowPlayingEmbeds(currentState, livePos, livePing, liveVol);
          const updatedRows = buildMusicControlRows(
            currentState.engineState === 'paused',
            currentState.loopMode,
            currentState.upcoming.length,
            currentState.upcoming,
          );

          await interaction.editReply({
            embeds: [updatedNow, updatedNext],
            components: updatedRows,
          }).catch(() => {
            clearInterval(interval);
          });
        } catch {
          clearInterval(interval);
        }
      }, 2500);
    },
  };
}
