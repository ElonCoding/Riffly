/**
 * /queue command — shows the current queue.
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { Command } from './types.js';
import type { GuildPlayerManager } from '../player/guild-player.js';

function formatDuration(ms: number): string {
  if (ms <= 0) return '∞';
  const totalSec = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

const PAGE_SIZE = 10;

export function makeQueueCommand(playerManager: GuildPlayerManager): Command {
  return {
    data: new SlashCommandBuilder()
      .setName('queue')
      .setDescription('Show the current queue.')
      .addIntegerOption((opt) =>
        opt.setName('page').setDescription('Page number').setMinValue(1),
      ),
    async execute(interaction) {
      const guildId = interaction.guildId!;
      const state = playerManager.getState(guildId);
      const page = interaction.options.getInteger('page') ?? 1;

      if (!state.current && state.upcoming.length === 0) {
        await interaction.reply({ content: '📭 The queue is empty.', ephemeral: true });
        return;
      }

      const upcoming = state.upcoming;
      const totalPages = Math.max(1, Math.ceil(upcoming.length / PAGE_SIZE));
      const clampedPage = Math.min(page, totalPages);
      const offset = (clampedPage - 1) * PAGE_SIZE;
      const slice = upcoming.slice(offset, offset + PAGE_SIZE);

      const lines: string[] = [];
      if (state.current) {
        const status = state.engineState === 'paused' ? '⏸️' : '▶️';
        lines.push(
          `**${status} Now Playing:** ${state.current.title} — ${state.current.author} \`[${formatDuration(state.current.lengthMs)}]\``,
        );
      }
      if (slice.length > 0) {
        lines.push('');
        lines.push('**Up Next:**');
        for (const [i, track] of slice.entries()) {
          lines.push(
            `\`${offset + i + 1}.\` ${track.title} — ${track.author} \`[${formatDuration(track.lengthMs)}]\``,
          );
        }
      }

      const embed = new EmbedBuilder()
        .setTitle('📋 Queue')
        .setDescription(lines.join('\n'))
        .setFooter({ text: `Page ${clampedPage}/${totalPages} · ${upcoming.length} track(s) in queue · Loop: ${state.loopMode}` })
        .setColor(0x5865f2);

      await interaction.reply({ embeds: [embed] });
    },
  };
}
