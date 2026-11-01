/**
 * Command interaction helper utilities.
 *
 * Provides voice channel co-location verification and interaction safety guards.
 */

import { ButtonInteraction, ChatInputCommandInteraction, GuildMember } from 'discord.js';

/**
 * Common shape for interactions that have guild, member, and client access.
 */
export type VoiceGuardedInteraction = {
  readonly guildId: string | null;
  readonly guild?: unknown;
  readonly client: { readonly guilds: { readonly cache: { get(id: string): unknown } } };
  readonly member?: unknown;
};

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
export function getBotVoiceChannelId(interaction: VoiceGuardedInteraction): string | null {
  if (!interaction.guildId) return null;

  const guild =
    (interaction as { guild?: { members?: { me?: { voice?: { channelId?: string | null } } } } })
      .guild ??
    (interaction.client.guilds.cache.get(interaction.guildId) as
      { members?: { me?: { voice?: { channelId?: string | null } } } } | undefined);
  const me =
    guild?.members?.me ?? (guild as { me?: { voice?: { channelId?: string | null } } } | null)?.me;

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
export function canModifyQueue(interaction: VoiceGuardedInteraction): boolean {
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
  interaction: ChatInputCommandInteraction | ButtonInteraction,
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

/**
 * Formats a duration in milliseconds into a standard timestamp string.
 * e.g. 83000ms -> "01:23" (if padMinutes=true) or "1:23"
 */
export function formatDuration(ms: number, padMinutes = false): string {
  if (ms <= 0) return padMinutes ? '00:00' : '0:00';
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  const minStr = padMinutes ? String(minutes).padStart(2, '0') : String(minutes);
  const secStr = String(seconds).padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${secStr}`;
  }
  return `${minStr}:${secStr}`;
}

/**
 * Generates an ASCII visual progress bar for track playback.
 * e.g. 🔘▬▬▬▬▬▬▬▬▬▬ 01:23 / 03:45
 */
export function createProgressBar(currentMs: number, totalMs: number, barLength = 12): string {
  if (totalMs <= 0) {
    return (
      '🔘' + '▬'.repeat(Math.max(1, barLength - 1)) + ` ${formatDuration(currentMs, true)} / ∞`
    );
  }

  const clampedCurrent = Math.max(0, Math.min(currentMs, totalMs));
  const progressRatio = clampedCurrent / totalMs;
  const indicatorIndex = Math.min(barLength - 1, Math.floor(progressRatio * barLength));

  const before = '▬'.repeat(indicatorIndex);
  const after = '▬'.repeat(Math.max(0, barLength - 1 - indicatorIndex));

  return `${before}🔘${after} ${formatDuration(clampedCurrent, true)} / ${formatDuration(totalMs, true)}`;
}

/**
 * Parses user-provided timestamp input into milliseconds.
 * Supports:
 * - "90" or "90s" -> 90,000ms
 * - "1:30" or "01:30" -> 90,000ms
 * - "1m30s" or "1m 30s" -> 90,000ms
 * - "1:05:30" -> 3,930,000ms
 * - "2h15m" -> 8,100,000ms
 * Returns null if the format is invalid or out of bounds.
 */
export function parseTimestamp(input: string): number | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  // Pattern 1: Pure number (seconds)
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    const sec = parseFloat(trimmed);
    return isFinite(sec) && sec >= 0 ? Math.floor(sec * 1000) : null;
  }

  // Pattern 2: Colon-delimited: mm:ss or hh:mm:ss
  if (/^\d+(?::\d+)+$/.test(trimmed)) {
    const parts = trimmed.split(':').map((p) => parseInt(p, 10));
    if (parts.some((p) => isNaN(p) || p < 0)) return null;
    if (parts.length === 2) {
      const [m, s] = parts;
      if (m === undefined || s === undefined || s >= 60) return null;
      return (m * 60 + s) * 1000;
    }
    if (parts.length === 3) {
      const [h, m, s] = parts;
      if (h === undefined || m === undefined || s === undefined || m >= 60 || s >= 60) return null;
      return (h * 3600 + m * 60 + s) * 1000;
    }
    return null;
  }

  // Pattern 3: Duration string with units, e.g. 1h30m, 90s, 1m 30s, 2h 15m 10s
  const unitRegex = /^(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+)s)?$/;
  const match = trimmed.match(unitRegex);
  if (match && (match[1] !== undefined || match[2] !== undefined || match[3] !== undefined)) {
    const hours = match[1] ? parseInt(match[1], 10) : 0;
    const minutes = match[2] ? parseInt(match[2], 10) : 0;
    const seconds = match[3] ? parseInt(match[3], 10) : 0;
    return (hours * 3600 + minutes * 60 + seconds) * 1000;
  }

  return null;
}
