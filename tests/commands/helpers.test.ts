import { describe, expect, it, vi } from 'vitest';
import type { ChatInputCommandInteraction } from 'discord.js';
import {
  canModifyQueue,
  getBotVoiceChannelId,
  getMemberVoiceChannelId,
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
});
