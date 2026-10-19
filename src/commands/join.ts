/**
 * /join command
 *
 * Connects the bot to the voice channel the invoking user is currently in.
 */

import { GuildMember, SlashCommandBuilder } from 'discord.js';
import type { Command } from './types.js';
import type { GuildPlayerManager } from '../player/guild-player.js';
import { RifflyError } from '../errors.js';

export const joinCommandData = new SlashCommandBuilder()
  .setName('join')
  .setDescription('Connect the bot to your current voice channel.');

function getVoiceChannelId(member: unknown): string | null {
  if (member instanceof GuildMember) {
    return member.voice.channelId;
  }
  if (member && typeof member === 'object' && 'voice' in member) {
    const v = (member as { voice?: { channelId?: string | null } }).voice;
    return typeof v?.channelId === 'string' ? v.channelId : null;
  }
  return null;
}

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

      const voiceChannelId = getVoiceChannelId(interaction.member);
      if (!voiceChannelId) {
        await interaction.reply({
          content: '❌ You must be in a voice channel to use /join.',
          ephemeral: true,
        });
        return;
      }

      try {
        await playerManager.join(interaction.guildId, voiceChannelId);
        await interaction.reply(`🔊 Joined <#${voiceChannelId}>!`);
      } catch (err) {
        const message =
          err instanceof RifflyError ? err.userMessage : '💥 Failed to join voice channel.';
        await interaction.reply({ content: message, ephemeral: true });
      }
    },
  };
}
