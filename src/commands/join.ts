/**
 * /join command
 *
 * Connects the bot to the voice channel the invoking user is currently in.
 */

import { SlashCommandBuilder } from 'discord.js';
import type { Command } from './types.js';
import type { GuildPlayerManager } from '../player/guild-player.js';
import { RifflyError } from '../errors.js';
import { resolveMemberVoiceChannelId } from './helpers.js';

export const joinCommandData = new SlashCommandBuilder()
  .setName('join')
  .setDescription('Connect the bot to your current voice channel.');

export function makeJoinCommand(playerManager: GuildPlayerManager): Command {
  return {
    data: joinCommandData,
    async execute(interaction) {
      if (!interaction.inGuild() || !interaction.guildId) {
        await interaction.reply({
          content: '❌ This command can only be used in a server.',
          ephemeral: true,
        });
        return;
      }

      const voiceChannelId = await resolveMemberVoiceChannelId(interaction);
      if (!voiceChannelId) {
        await interaction.reply({
          content: '❌ You must be in a voice channel to use /join.',
          ephemeral: true,
        });
        return;
      }

      // Safeguard C-02: Asynchronous voice handshakes can take 2-5 seconds.
      await interaction.deferReply();

      try {
        await playerManager.join(interaction.guildId, voiceChannelId);
        await interaction.editReply(`🔊 Joined <#${voiceChannelId}>!`);
      } catch (err) {
        const message =
          err instanceof RifflyError ? err.userMessage : '💥 Failed to join voice channel.';
        await interaction.editReply(message);
      }
    },
  };
}
