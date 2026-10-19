/**
 * /resume command
 */

import { SlashCommandBuilder } from 'discord.js';
import type { Command } from './types.js';
import type { GuildPlayerManager } from '../player/guild-player.js';
import { RifflyError } from '../errors.js';

export function makeResumeCommand(playerManager: GuildPlayerManager): Command {
  return {
    data: new SlashCommandBuilder().setName('resume').setDescription('Resume paused playback.'),
    async execute(interaction) {
      const guildId = interaction.guildId!;
      try {
        await playerManager.resume(guildId);
        await interaction.reply('▶️ Resumed.');
      } catch (err) {
        const message = err instanceof RifflyError ? err.userMessage : '💥 Could not resume.';
        await interaction.reply({ content: message, ephemeral: true });
      }
    },
  };
}
