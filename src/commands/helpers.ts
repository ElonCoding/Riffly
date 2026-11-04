/**
 * Command interaction helper utilities.
 *
 * Provides voice channel co-location verification and interaction safety guards.
 */

import { ButtonInteraction, ChatInputCommandInteraction, GuildMember, PermissionFlagsBits } from 'discord.js';
import { RifflyError } from '../errors.js';

/**
 * Common shape for interactions that have guild, member, and client access.
 */
export type VoiceGuardedInteraction = {
  readonly guildId: string | null;
  readonly guild?: unknown;
  readonly client?: { readonly guilds?: { readonly cache?: { get(id: string): unknown } }; readonly user?: { id: string } };
  readonly member?: unknown;
};

interface HelperGuildVoiceStateShape {
  readonly voiceStates?: {
    readonly cache?: {
      get(id: string): { readonly channelId?: string | null } | undefined;
    };
  };
  readonly members?: {
    readonly cache?: {
      get(id: string): { readonly voice?: { readonly channelId?: string | null } } | undefined;
    };
    fetch?(id: string): Promise<{ readonly voice?: { readonly channelId?: string | null } } | undefined>;
    readonly me?: {
      readonly voice?: { readonly channelId?: string | null };
      permissionsIn?(channel: unknown): { has(perm: unknown): boolean };
    };
  };
  readonly channels?: {
    readonly cache?: {
      get(id: string): {
        permissionsFor?(member: unknown): { has(perm: unknown): boolean };
      } | undefined;
    };
  };
  readonly me?: {
    readonly voice?: { readonly channelId?: string | null };
  };
}

/**
 * Extract the invoking member's current voice channel ID, or null if not in voice.
 */
export function getMemberVoiceChannelId(member: unknown): string | null {
  if (member instanceof GuildMember) {
    return member.voice?.channelId ?? null;
  }
  if (member && typeof member === 'object' && 'voice' in member) {
    const v = (member as { voice?: { channelId?: string | null } }).voice;
    return typeof v?.channelId === 'string' ? v.channelId : null;
  }
  return null;
}

/**
 * Asynchronously resolves the invoking member's voice channel ID from interaction,
 * falling back across interaction.member, guild voice states cache, and REST fetch.
 */
export async function resolveMemberVoiceChannelId(
  interaction: {
    readonly member?: unknown;
    readonly guild?: unknown;
    readonly user?: { readonly id: string };
    readonly guildId?: string | null;
    readonly client?: { readonly guilds?: { readonly cache?: { get(id: string): unknown } }; readonly user?: { readonly id: string } };
  },
): Promise<string | null> {
  // 1. Direct member check
  const directId = getMemberVoiceChannelId(interaction.member);
  if (directId) return directId;

  const userId = interaction.user?.id;
  const guild =
    (interaction as { guild?: HelperGuildVoiceStateShape }).guild ??
    ((interaction.guildId && interaction.client?.guilds?.cache
      ? interaction.client.guilds.cache.get(interaction.guildId)
      : null) as HelperGuildVoiceStateShape | null);

  if (guild && userId) {
    // 2. Guild voiceStates cache lookup
    const voiceState = guild.voiceStates?.cache?.get(userId);
    if (typeof voiceState?.channelId === 'string' && voiceState.channelId.length > 0) {
      return voiceState.channelId;
    }

    // 3. Guild members cache lookup
    const cachedMember = guild.members?.cache?.get(userId);
    if (typeof cachedMember?.voice?.channelId === 'string' && cachedMember.voice.channelId.length > 0) {
      return cachedMember.voice.channelId;
    }

    // 4. REST fetch member if uncached
    try {
      const fetchedMember = await guild.members?.fetch?.(userId);
      if (typeof fetchedMember?.voice?.channelId === 'string' && fetchedMember.voice.channelId.length > 0) {
        return fetchedMember.voice.channelId;
      }
      const fetchedVoiceState = guild.voiceStates?.cache?.get(userId);
      if (typeof fetchedVoiceState?.channelId === 'string' && fetchedVoiceState.channelId.length > 0) {
        return fetchedVoiceState.channelId;
      }
    } catch {
      // Ignore fetch failures
    }
  }

  return null;
}

/**
 * Extract Riffly's voice channel ID in the guild, or null if not connected.
 */
export function getBotVoiceChannelId(interaction: VoiceGuardedInteraction): string | null {
  if (!interaction.guildId) return null;

  const guild =
    (interaction as { guild?: { members?: { me?: { voice?: { channelId?: string | null } } }; voiceStates?: { cache?: { get(id: string): { channelId?: string | null } | undefined } } } })
      .guild ??
    (interaction.client?.guilds?.cache?.get(interaction.guildId) as
      { members?: { me?: { voice?: { channelId?: string | null } } }; voiceStates?: { cache?: { get(id: string): { channelId?: string | null } | undefined } } } | undefined);

  const me =
    guild?.members?.me ?? (guild as { me?: { voice?: { channelId?: string | null } } } | null)?.me;

  if (me?.voice?.channelId) {
    return me.voice.channelId;
  }

  const botId = (interaction.client as { user?: { id: string } } | undefined)?.user?.id;
  if (botId && guild?.voiceStates?.cache) {
    const vs = guild.voiceStates.cache.get(botId);
    if (vs?.channelId) return vs.channelId;
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
  let memberVoiceChannelId = getMemberVoiceChannelId(interaction.member);
  const userId = (interaction as { user?: { id: string } }).user?.id;
  const guild = (interaction as { guild?: HelperGuildVoiceStateShape }).guild;
  if (!memberVoiceChannelId && guild && userId) {
    memberVoiceChannelId = guild.voiceStates?.cache?.get(userId)?.channelId ?? null;
  }
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
  const memberVoiceChannelId = await resolveMemberVoiceChannelId(interaction);
  const botVoiceChannelId = getBotVoiceChannelId(interaction);

  if (!botVoiceChannelId || !memberVoiceChannelId || memberVoiceChannelId !== botVoiceChannelId) {
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
 * Generates dynamic audio visualizer waveform bars (Boogie/Hades style).
 * e.g. ılıılılllıılı | 01:23 / 03:45
 */
export function createAudioVisualizer(
  currentMs: number,
  totalMs: number,
  isPlaying = true,
): string {
  if (!isPlaying) {
    return '─── ⏸️ PAUSED ───';
  }
  const frames = [
    ' ▃▅▇█▇▅▃ ',
    '▃▅▇██▇▅▃ ',
    '▅▇██▇▅▃ ▂',
    '▇██▇▅▃ ▂▃',
    '██▇▅▃ ▂▃▅',
    '█▇▅▃ ▂▃▅▇',
  ];
  const timeBasis = currentMs > 0 ? currentMs : Date.now();
  const step = Math.floor(timeBasis / 500) % frames.length;
  const waveform = frames[step] ?? ' ▃▅▇█▇▅▃ ';
  const curStr = formatDuration(Math.max(0, currentMs), true);
  const totStr = totalMs > 0 ? formatDuration(totalMs, true) : '∞';
  return `\`${waveform}\` \`[${curStr} / ${totStr}]\``;
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

/**
 * Pre-flight validation ensuring Riffly has required voice permissions in the target channel.
 *
 * Checks ViewChannel, Connect, and Speak permissions for the bot member.
 * Throws RifflyError.voicePermissionDenied() if any required permission is missing.
 */
export function assertBotVoicePermissions(
  interaction: { readonly guild?: unknown },
  voiceChannelId: string,
): void {
  const guild = interaction.guild as {
    members?: { me?: { permissionsIn(channel: unknown): { has(perm: unknown): boolean } } };
    channels?: { cache?: { get(id: string): { permissionsFor(member: unknown): { has(perm: unknown): boolean } } | undefined } };
  } | undefined;

  const me = guild?.members?.me;
  if (!me) return;

  const channel = guild?.channels?.cache?.get(voiceChannelId);
  const permissions =
    (typeof me.permissionsIn === 'function' ? me.permissionsIn(voiceChannelId) : undefined) ??
    (channel && typeof channel.permissionsFor === 'function' ? channel.permissionsFor(me) : undefined);

  if (!permissions || typeof permissions.has !== 'function') return;

  const hasPerm = (bit: bigint, name: string): boolean => {
    try {
      if (permissions.has(name) === false) return false;
    } catch {
      // Ignore
    }
    try {
      if (permissions.has(bit) === false) return false;
    } catch {
      // Ignore
    }
    return true;
  };

  const missing: string[] = [];
  if (!hasPerm(PermissionFlagsBits.ViewChannel, 'ViewChannel')) {
    missing.push('ViewChannel');
  }
  if (!hasPerm(PermissionFlagsBits.Connect, 'Connect')) {
    missing.push('Connect');
  }
  if (!hasPerm(PermissionFlagsBits.Speak, 'Speak')) {
    missing.push('Speak');
  }

  if (missing.length > 0) {
    throw RifflyError.voicePermissionDenied(missing);
  }
}

