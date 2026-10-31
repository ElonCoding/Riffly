/**
 * /queue command — display paginated queue with track details and total duration.
 */

import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { Command } from './types.js';
import type { GuildPlayerManager } from '../player/guild-player.js';
import { formatDuration } from './helpers.js';

const PAGE_SIZE = 10;

export const queueCommandData = new SlashCommandBuilder()
  .setName('queue')
  .setDescription('Show the current queue.')
  .addIntegerOption((opt) => opt.setName('page').setDescription('Page number').setMinValue(1));

export function makeQueueCommand(playerManager: GuildPlayerManager): Command {
  return {
    data: queueCommandData,
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
      const requestedPage = interaction.options.getInteger('page') ?? 1;

      if (!state.current && state.upcoming.length === 0) {
        await interaction.editReply('📭 The queue is empty.');
        return;
      }

      const upcoming = state.upcoming;
      const totalPages = Math.max(1, Math.ceil(upcoming.length / PAGE_SIZE));
      const clampedPage = Math.min(Math.max(1, requestedPage), totalPages);
      const offset = (clampedPage - 1) * PAGE_SIZE;
      const slice = upcoming.slice(offset, offset + PAGE_SIZE);

      // Compute total queue duration (current track + all upcoming tracks)
      const currentMs = state.current && !state.current.isStream ? state.current.lengthMs : 0;
      const upcomingMs = upcoming.reduce(
        (sum, t) => sum + (!t.isStream && t.lengthMs > 0 ? t.lengthMs : 0),
        0,
      );
      const totalDurationMs = currentMs + upcomingMs;

      const lines: string[] = [];
      if (state.current) {
        const status = state.engineState === 'paused' ? '⏸️' : '▶️';
        const dur = state.current.isStream ? '🔴 Live' : formatDuration(state.current.lengthMs, true);
        lines.push(`**${status} Now Playing:** [${state.current.title}](${state.current.uri ?? '#'}) — ${state.current.author} \`[${dur}]\``);
      }

      if (slice.length > 0) {
        lines.push('');
        lines.push('**Up Next:**');
        for (const [i, track] of slice.entries()) {
          const dur = track.isStream ? '🔴 Live' : formatDuration(track.lengthMs, true);
          lines.push(`\`${offset + i + 1}.\` [${track.title}](${track.uri ?? '#'}) — ${track.author} \`[${dur}]\``);
        }
      }

      const loopDisplay =
        state.loopMode === 'off'
          ? 'Off'
          : state.loopMode === 'track'
            ? '🔂 Track'
            : '🔁 Queue';

      const totalTracks = (state.current ? 1 : 0) + upcoming.length;
      const embed = new EmbedBuilder()
        .setTitle('📋 Queue')
        .setDescription(lines.join('\n'))
        .setFooter({
          text: `Page ${clampedPage}/${totalPages} · ${totalTracks} track(s) · Total: ${formatDuration(totalDurationMs)} · Loop: ${loopDisplay}`,
        })
        .setColor(0x5865f2);

      await interaction.editReply({ embeds: [embed] });
    },
  };
}
