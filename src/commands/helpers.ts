/**
 * Command interaction helper utilities.
 *
 * Provides voice channel co-location verification and interaction safety guards.
 */

import { ChatInputCommandInteraction, GuildMember } from 'discord.js';

/**
 * Extract the invoking member's current voice channel ID, or null if not in voice.
 */
export function getMemberVoiceChannelId(member: unknown): string | null {
  if (member instanceof GuildMember) {
    return member.voice.channelId;
  }
  if (member && typeof member === 'object' && 'voice' in member) {
    const v = (member as { voice?: { channelId?: string | null } }).voice;
    return typeof v?.channelId === 'string' ? v.channelId : null;
  }
  return null;
}

/**
 * Extract Riffly's voice channel ID in the guild, or null if not connected.
 */
export function getBotVoiceChannelId(interaction: ChatInputCommandInteraction): string | null {
  if (!interaction.guildId) return null;

  const guild = interaction.guild ?? interaction.client.guilds.cache.get(interaction.guildId);
  const me =
    guild?.members?.me ??
    (guild as { me?: { voice?: { channelId?: string | null } } } | null)?.me;

  if (me?.voice?.channelId) {
    return me.voice.channelId;
  }

  return null;
}

/**
 * Verifies whether the invoking user is in the same voice channel as the bot.
 *
 * Rules:
 * - Returns true if the member is in the same voice channel as the bot.
 * - Returns false if the bot is not in a channel or member is in a different voice channel.
 */
export function canModifyQueue(interaction: ChatInputCommandInteraction): boolean {
  const memberVoiceChannelId = getMemberVoiceChannelId(interaction.member);
  const botVoiceChannelId = getBotVoiceChannelId(interaction);

  if (!botVoiceChannelId || !memberVoiceChannelId) {
    return false;
  }

  return memberVoiceChannelId === botVoiceChannelId;
}

/**
 * Co-location guard helper.
 * If the user cannot modify playback (not in the same voice channel as Riffly),
 * sends an ephemeral response and returns false.
 */
export async function requireSameVoiceChannel(
  interaction: ChatInputCommandInteraction,
): Promise<boolean> {
  if (!canModifyQueue(interaction)) {
    const message = '🔇 You must be in the same voice channel as Riffly to use this command.';
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: message });
    } else {
      await interaction.reply({ content: message, ephemeral: true });
    }
    return false;
  }
  return true;
}
