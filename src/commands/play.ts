/**
 * /play command
 *
 * Validates input, resolves a track (or playlist), joins voice, and enqueues.
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
import type { ResolveResult, TrackResolver } from '../provider/resolver.js';
import { RifflyError } from '../errors.js';
import { validatePlayInput } from './input.js';
import {
  assertBotVoicePermissions,
  createAudioVisualizer,
  createProgressBar,
  getBotVoiceChannelId,
  resolveMemberVoiceChannelId,
} from './helpers.js';

function formatDuration(ms: number): string {
  if (ms <= 0) return '∞';
  const totalSec = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function buildMusicActionRows(queueCount = 0): ActionRowBuilder<ButtonBuilder>[] {
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('riffly_shuffle')
      .setLabel('Shuffle')
      .setEmoji('🔀')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(queueCount < 2),
    new ButtonBuilder()
      .setCustomId('riffly_pause')
      .setLabel('Pause')
      .setEmoji('⏸️')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('riffly_resume')
      .setLabel('Play')
      .setEmoji('▶️')
      .setStyle(ButtonStyle.Success)
      .setDisabled(true),
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
  );

  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('riffly_loop')
      .setLabel('Loop')
      .setEmoji('🔁')
      .setStyle(ButtonStyle.Secondary),
  );

  return [row1, row2];
}

function buildEnqueuedEmbed(resolved: ResolveResult, started: boolean): EmbedBuilder {
  const isPlaylist = resolved.tracks.length > 1;

  if (isPlaylist) {
    const firstTrack = resolved.tracks[0];
    const visualizer = started
      ? `\n\n🔊 **Visualizer:** ${createAudioVisualizer(0, firstTrack?.lengthMs ?? 0, true)}\n${createProgressBar(0, firstTrack?.lengthMs ?? 0)}`
      : '';

    const embed = new EmbedBuilder()
      .setTitle('📋 Playlist Enqueued')
      .setDescription(`${resolved.summary}${visualizer}`)
      .addFields(
        { name: 'Total Tracks', value: `${resolved.tracks.length}`, inline: true },
        {
          name: 'Playback',
          value: started
            ? `▶️ Now playing: **${firstTrack?.title ?? 'Track'}**`
            : '📋 Added to queue',
          inline: true,
        },
      )
      .setColor(0x5865f2);

    if (firstTrack?.artworkUrl) {
      embed.setThumbnail(firstTrack.artworkUrl);
    }
    return embed;
  }

  const track = resolved.tracks[0];
  if (!track) {
    return new EmbedBuilder()
      .setTitle('📋 Added to Queue')
      .setDescription(resolved.summary)
      .setColor(0x5865f2);
  }

  const titlePrefix = started ? '▶️ Now Playing' : '📋 Added to Queue';
  const trackTitle = track.uri ? `**[${track.title}](${track.uri})**` : `**${track.title}**`;
  const visualizer = started
    ? `\n\n🔊 **Visualizer:** ${createAudioVisualizer(0, track.lengthMs, true)}\n${createProgressBar(0, track.lengthMs)}`
    : '';

  const embed = new EmbedBuilder()
    .setTitle(titlePrefix)
    .setDescription(`${trackTitle}${visualizer}`)
    .addFields(
      { name: 'Artist', value: track.author, inline: true },
      {
        name: 'Duration',
        value: track.isStream ? '🔴 Live' : formatDuration(track.lengthMs),
        inline: true,
      },
    )
    .setColor(0x5865f2);

  if (track.artworkUrl) {
    embed.setThumbnail(track.artworkUrl);
  }
  return embed;
}

export const playCommandData = new SlashCommandBuilder()
  .setName('play')
  .setDescription('Play a song or playlist from a search query or URL.')
  .addStringOption((opt) =>
    opt
      .setName('input')
      .setDescription('Song name, search query, or supported URL')
      .setRequired(true),
  );

export function makePlayCommand(
  playerManager: GuildPlayerManager,
  resolver: TrackResolver,
): Command {
  return {
    data: playCommandData,

    async execute(interaction) {
      await interaction.deferReply();

      if (!interaction.inGuild() || !interaction.guildId) {
        await interaction.editReply('❌ This command can only be used in a server.');
        return;
      }

      const raw = interaction.options.getString('input', true);
      const validation = validatePlayInput(raw);
      if (!validation.ok) {
        const messages: Record<string, string> = {
          empty: '❌ Please provide a search query or URL.',
          'too-long': '❌ Input is too long. Keep it under 500 characters.',
          'control-characters': '❌ Input contains invalid characters.',
        };
        await interaction.editReply(messages[validation.problem] ?? '❌ Invalid input.');
        return;
      }

      // Require the user to be in a voice channel
      const voiceChannelId = await resolveMemberVoiceChannelId(interaction);
      if (!voiceChannelId) {
        await interaction.editReply(RifflyError.notInVoiceChannel().userMessage);
        return;
      }

      // Verify co-location if bot is already in a voice channel
      const botVoiceChannelId = getBotVoiceChannelId(interaction);
      if (botVoiceChannelId && botVoiceChannelId !== voiceChannelId) {
        await interaction.editReply(
          '🔇 You must be in the same voice channel as Riffly to play music.',
        );
        return;
      }

      const guildId = interaction.guildId;

      try {
        // Pre-flight voice permissions check (ViewChannel, Connect, Speak)
        assertBotVoicePermissions(interaction, voiceChannelId);

        if (interaction.channelId) {
          playerManager.setTextChannelId?.(guildId, interaction.channelId);
        }

        // Join voice channel (idempotent / awaits handshake)
        await playerManager.join(guildId, voiceChannelId);

        // Resolve track(s)
        const resolved = await resolver.resolve(validation.value);

        // Enqueue and possibly start playback
        const { started } = await playerManager.play(guildId, resolved.tracks);

        const components = started ? buildMusicActionRows(resolved.tracks.length - 1) : [];

        if (started && typeof playerManager.waitForTrackStart === 'function') {
          const firstTrackTitle = resolved.tracks[0]?.title ?? 'Track';
          await interaction.editReply({
            content: `⏳ Loading track: **${firstTrackTitle}**...`,
          });

          try {
            await playerManager.waitForTrackStart(guildId, 7000);
            const embed = buildEnqueuedEmbed(resolved, true);
            await interaction.editReply({ content: null, embeds: [embed], components });
          } catch (trackErr: unknown) {
            const errMsg =
              trackErr instanceof Error ? trackErr.message : String(trackErr);
            if (errMsg.includes('timed out')) {
              const embed = buildEnqueuedEmbed(resolved, true);
              await interaction.editReply({
                content:
                  '⏳ Audio stream is taking longer than expected to buffer. Check `/musicdiag` for status.',
                embeds: [embed],
                components,
              });
            } else {
              await interaction.editReply({
                content: `❌ Playback failed for **${firstTrackTitle}**: ${errMsg}. Skipping to next track...`,
                embeds: [],
              });
            }
          }
        } else {
          const embed = buildEnqueuedEmbed(resolved, started);
          await interaction.editReply({ embeds: [embed], components });
        }
      } catch (err) {
        const message =
          err instanceof RifflyError
            ? err.userMessage
            : '💥 Something went wrong. Please try again.';
        if (!(err instanceof RifflyError)) {
          console.error('[Play] Unexpected error:', err);
        }
        await interaction.editReply(message);
      }
    },
  };
}
