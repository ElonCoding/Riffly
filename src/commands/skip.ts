/**
 * /skip command
 */

import { SlashCommandBuilder } from 'discord.js';
import type { Command } from './types.js';
import type { GuildPlayerManager } from '../player/guild-player.js';
import { RifflyError } from '../errors.js';

export const skipCommandData = new SlashCommandBuilder()
  .setName('skip')
  .setDescription('Skip the current track.');

export function makeSkipCommand(playerManager: GuildPlayerManager): Command {
  return {
    data: skipCommandData,
    async execute(interaction) {
      const guildId = interaction.guildId!;
      try {
        const next = await playerManager.skip(guildId);
        const msg = next
          ? `⏭️ Skipped. Now playing: **${next.title}** by ${next.author}`
          : '⏭️ Skipped. Queue is now empty.';
        await interaction.reply(msg);
      } catch (err) {
        const message = err instanceof RifflyError ? err.userMessage : '💥 Could not skip.';
        await interaction.reply({ content: message, ephemeral: true });
      }
    },
  };
}
