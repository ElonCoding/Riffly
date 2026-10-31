import { describe, expect, it, vi } from 'vitest';
import type { ChatInputCommandInteraction } from 'discord.js';
import {
  canModifyQueue,
  createProgressBar,
  formatDuration,
  getBotVoiceChannelId,
  getMemberVoiceChannelId,
  parseTimestamp,
  requireSameVoiceChannel,
} from '../../src/commands/helpers.js';

describe('command helpers', () => {
  describe('getMemberVoiceChannelId', () => {
    it('returns null if member has no voice property', () => {
      expect(getMemberVoiceChannelId(null)).toBeNull();
      expect(getMemberVoiceChannelId({})).toBeNull();
    });

    it('returns voiceChannelId from member object', () => {
      const member = { voice: { channelId: 'vc-123' } };
      expect(getMemberVoiceChannelId(member)).toBe('vc-123');
    });
  });

  describe('getBotVoiceChannelId', () => {
    it('returns null if interaction has no guildId', () => {
      const interaction = { guildId: null } as unknown as ChatInputCommandInteraction;
      expect(getBotVoiceChannelId(interaction)).toBeNull();
    });

    it('returns channelId from interaction.guild.members.me.voice', () => {
      const interaction = {
        guildId: 'guild-1',
        guild: {
          members: {
            me: { voice: { channelId: 'vc-bot' } },
          },
        },
      } as unknown as ChatInputCommandInteraction;
      expect(getBotVoiceChannelId(interaction)).toBe('vc-bot');
    });

    it('falls back to client.guilds cache if interaction.guild is undefined', () => {
      const cacheMap = new Map([
        ['guild-1', { members: { me: { voice: { channelId: 'vc-cached' } } } }],
      ]);
      const interaction = {
        guildId: 'guild-1',
        guild: null,
        client: { guilds: { cache: cacheMap } },
      } as unknown as ChatInputCommandInteraction;
      expect(getBotVoiceChannelId(interaction)).toBe('vc-cached');
    });
  });

  describe('canModifyQueue', () => {
    it('returns false if bot is not in a voice channel', () => {
      const interaction = {
        guildId: 'guild-1',
        member: { voice: { channelId: 'vc-user' } },
        guild: { members: { me: { voice: { channelId: null } } } },
      } as unknown as ChatInputCommandInteraction;
      expect(canModifyQueue(interaction)).toBe(false);
    });

    it('returns false if member is not in a voice channel', () => {
      const interaction = {
        guildId: 'guild-1',
        member: { voice: { channelId: null } },
        guild: { members: { me: { voice: { channelId: 'vc-bot' } } } },
      } as unknown as ChatInputCommandInteraction;
      expect(canModifyQueue(interaction)).toBe(false);
    });

    it('returns false if member is in a different voice channel than bot', () => {
      const interaction = {
        guildId: 'guild-1',
        member: { voice: { channelId: 'vc-1' } },
        guild: { members: { me: { voice: { channelId: 'vc-2' } } } },
      } as unknown as ChatInputCommandInteraction;
      expect(canModifyQueue(interaction)).toBe(false);
    });

    it('returns true if member is in the exact same voice channel as bot', () => {
      const interaction = {
        guildId: 'guild-1',
        member: { voice: { channelId: 'vc-shared' } },
        guild: { members: { me: { voice: { channelId: 'vc-shared' } } } },
      } as unknown as ChatInputCommandInteraction;
      expect(canModifyQueue(interaction)).toBe(true);
    });
  });

  describe('requireSameVoiceChannel', () => {
    it('returns true when user can modify queue', async () => {
      const reply = vi.fn();
      const interaction = {
        guildId: 'guild-1',
        member: { voice: { channelId: 'vc-shared' } },
        guild: { members: { me: { voice: { channelId: 'vc-shared' } } } },
        reply,
      } as unknown as ChatInputCommandInteraction;

      const allowed = await requireSameVoiceChannel(interaction);
      expect(allowed).toBe(true);
      expect(reply).not.toHaveBeenCalled();
    });

    it('replies ephemeral message when user cannot modify queue and interaction is unreplied', async () => {
      const reply = vi.fn().mockResolvedValue(undefined);
      const interaction = {
        guildId: 'guild-1',
        member: { voice: { channelId: 'vc-1' } },
        guild: { members: { me: { voice: { channelId: 'vc-2' } } } },
        deferred: false,
        replied: false,
        reply,
      } as unknown as ChatInputCommandInteraction;

      const allowed = await requireSameVoiceChannel(interaction);
      expect(allowed).toBe(false);
      expect(reply).toHaveBeenCalledWith({
        content: '🔇 You must be in the same voice channel as Riffly to use this command.',
        ephemeral: true,
      });
    });

    it('edits reply when user cannot modify queue and interaction was already deferred', async () => {
      const editReply = vi.fn().mockResolvedValue(undefined);
      const interaction = {
        guildId: 'guild-1',
        member: { voice: { channelId: 'vc-1' } },
        guild: { members: { me: { voice: { channelId: 'vc-2' } } } },
        deferred: true,
        replied: false,
        editReply,
      } as unknown as ChatInputCommandInteraction;

      const allowed = await requireSameVoiceChannel(interaction);
      expect(allowed).toBe(false);
      expect(editReply).toHaveBeenCalledWith({
        content: '🔇 You must be in the same voice channel as Riffly to use this command.',
      });
    });
  });

  describe('formatDuration', () => {
    it('formats 0 or negative ms as 0:00 or 00:00', () => {
      expect(formatDuration(0)).toBe('0:00');
      expect(formatDuration(-100)).toBe('0:00');
      expect(formatDuration(0, true)).toBe('00:00');
    });

    it('formats minutes and seconds with and without padding', () => {
      expect(formatDuration(83_000, false)).toBe('1:23');
      expect(formatDuration(83_000, true)).toBe('01:23');
      expect(formatDuration(225_000, true)).toBe('03:45');
    });

    it('formats hours, minutes, and seconds', () => {
      expect(formatDuration(3_661_000)).toBe('1:01:01');
      expect(formatDuration(7_200_000)).toBe('2:00:00');
    });
  });

  describe('createProgressBar', () => {
    it('creates a live stream indicator when totalMs <= 0', () => {
      const bar = createProgressBar(0, 0, 12);
      expect(bar).toContain('🔘');
      expect(bar).toContain('∞');
    });

    it('creates progress bar with indicator at beginning', () => {
      const bar = createProgressBar(0, 180_000, 12);
      expect(bar.startsWith('🔘▬▬▬▬▬▬▬▬▬▬▬')).toBe(true);
      expect(bar).toContain('00:00 / 03:00');
    });

    it('creates progress bar with indicator in middle', () => {
      const bar = createProgressBar(90_000, 180_000, 12);
      expect(bar).toContain('🔘');
      expect(bar).toContain('01:30 / 03:00');
    });

    it('creates progress bar with indicator at end', () => {
      const bar = createProgressBar(180_000, 180_000, 12);
      expect(bar.startsWith('▬▬▬▬▬▬▬▬▬▬▬🔘')).toBe(true);
      expect(bar).toContain('03:00 / 03:00');
    });
  });

  describe('parseTimestamp', () => {
    it('parses pure number seconds', () => {
      expect(parseTimestamp('90')).toBe(90_000);
      expect(parseTimestamp('0')).toBe(0);
      expect(parseTimestamp('120.5')).toBe(120_500);
    });

    it('parses mm:ss timestamps', () => {
      expect(parseTimestamp('1:30')).toBe(90_000);
      expect(parseTimestamp('01:30')).toBe(90_000);
      expect(parseTimestamp('0:45')).toBe(45_000);
    });

    it('parses hh:mm:ss timestamps', () => {
      expect(parseTimestamp('1:05:30')).toBe(3_930_000);
      expect(parseTimestamp('01:00:00')).toBe(3_600_000);
    });

    it('parses unit duration strings', () => {
      expect(parseTimestamp('90s')).toBe(90_000);
      expect(parseTimestamp('1m30s')).toBe(90_000);
      expect(parseTimestamp('1m 30s')).toBe(90_000);
      expect(parseTimestamp('2h')).toBe(7_200_000);
      expect(parseTimestamp('2h15m')).toBe(8_100_000);
      expect(parseTimestamp('1h 2m 3s')).toBe(3_723_000);
    });

    it('returns null for invalid strings', () => {
      expect(parseTimestamp('')).toBeNull();
      expect(parseTimestamp('invalid')).toBeNull();
      expect(parseTimestamp('-10s')).toBeNull();
      expect(parseTimestamp('1:65')).toBeNull();
      expect(parseTimestamp('1:2:3:4')).toBeNull();
    });
  });
});
