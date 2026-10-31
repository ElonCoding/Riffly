import { describe, expect, it, vi } from 'vitest';
import type { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { makeSkipCommand } from '../../src/commands/skip.js';
import { makeStopCommand } from '../../src/commands/stop.js';
import type { GuildPlayerManager } from '../../src/player/guild-player.js';
import type { Track } from '../../src/audio/types.js';
import { RifflyError } from '../../src/errors.js';

describe('skip and stop commands', () => {
  const sampleTrack: Track = {
    encoded: 'encoded-skip-track',
    title: 'Next Song',
    author: 'Next Artist',
    lengthMs: 180000,
    identifier: 'id-skip',
    isSeekable: true,
    isStream: false,
    uri: 'https://example.com/next.mp3',
    artworkUrl: 'https://example.com/next.png',
  };

  describe('makeSkipCommand', () => {
    it('rejects if not in a guild', async () => {
      const playerManager = { skip: vi.fn() } as unknown as GuildPlayerManager;
      const cmd = makeSkipCommand(playerManager);
      const reply = vi.fn().mockResolvedValue(undefined);
      const interaction = {
        inGuild: () => false,
        guildId: null,
        reply,
      } as unknown as ChatInputCommandInteraction;

      await cmd.execute(interaction);
      expect(reply).toHaveBeenCalledWith({
        content: '❌ This command can only be used in a server.',
        ephemeral: true,
      });
    });

    it('rejects with ephemeral warning if member is not in same voice channel', async () => {
      const skipMock = vi.fn();
      const playerManager = { skip: skipMock } as unknown as GuildPlayerManager;
      const cmd = makeSkipCommand(playerManager);
      const reply = vi.fn().mockResolvedValue(undefined);
      const interaction = {
        inGuild: () => true,
        guildId: 'guild-1',
        member: { voice: { channelId: 'vc-1' } },
        guild: { members: { me: { voice: { channelId: 'vc-2' } } } },
        reply,
      } as unknown as ChatInputCommandInteraction;

      await cmd.execute(interaction);
      expect(reply).toHaveBeenCalledWith({
        content: '🔇 You must be in the same voice channel as Riffly to use this command.',
        ephemeral: true,
      });
      expect(skipMock).not.toHaveBeenCalled();
    });

    it('defers, calls skip, and edits reply with next track embed', async () => {
      const skipMock = vi.fn().mockResolvedValue(sampleTrack);
      const playerManager = { skip: skipMock } as unknown as GuildPlayerManager;
      const cmd = makeSkipCommand(playerManager);

      const deferReply = vi.fn().mockResolvedValue(undefined);
      const editReply = vi.fn().mockResolvedValue(undefined);
      const interaction = {
        inGuild: () => true,
        guildId: 'guild-1',
        member: { voice: { channelId: 'vc-shared' } },
        guild: { members: { me: { voice: { channelId: 'vc-shared' } } } },
        deferReply,
        editReply,
      } as unknown as ChatInputCommandInteraction;

      await cmd.execute(interaction);
      expect(deferReply).toHaveBeenCalled();
      expect(skipMock).toHaveBeenCalledWith('guild-1');
      expect(editReply).toHaveBeenCalled();
      const callArg = editReply.mock.calls[0]?.[0] as { embeds?: EmbedBuilder[] };
      expect(callArg.embeds?.[0]?.data.title).toBe('⏭️ Skipped');
      expect(callArg.embeds?.[0]?.data.description).toContain('Next Song');
    });

    it('edits reply with empty queue note when no track remains', async () => {
      const skipMock = vi.fn().mockResolvedValue(undefined);
      const playerManager = { skip: skipMock } as unknown as GuildPlayerManager;
      const cmd = makeSkipCommand(playerManager);

      const deferReply = vi.fn().mockResolvedValue(undefined);
      const editReply = vi.fn().mockResolvedValue(undefined);
      const interaction = {
        inGuild: () => true,
        guildId: 'guild-1',
        member: { voice: { channelId: 'vc-shared' } },
        guild: { members: { me: { voice: { channelId: 'vc-shared' } } } },
        deferReply,
        editReply,
      } as unknown as ChatInputCommandInteraction;

      await cmd.execute(interaction);
      expect(editReply).toHaveBeenCalled();
      const emptyCallArg = editReply.mock.calls[0]?.[0] as { embeds?: EmbedBuilder[] };
      expect(emptyCallArg.embeds?.[0]?.data.description).toContain('Queue is now empty.');
    });

    it('handles notPlaying error on skip', async () => {
      const skipMock = vi.fn().mockRejectedValue(RifflyError.notPlaying());
      const playerManager = { skip: skipMock } as unknown as GuildPlayerManager;
      const cmd = makeSkipCommand(playerManager);

      const deferReply = vi.fn().mockResolvedValue(undefined);
      const editReply = vi.fn().mockResolvedValue(undefined);
      const interaction = {
        inGuild: () => true,
        guildId: 'guild-1',
        member: { voice: { channelId: 'vc-shared' } },
        guild: { members: { me: { voice: { channelId: 'vc-shared' } } } },
        deferReply,
        editReply,
      } as unknown as ChatInputCommandInteraction;

      await cmd.execute(interaction);
      expect(editReply).toHaveBeenCalledWith('⏹️ Nothing is currently playing.');
    });
  });

  describe('makeStopCommand', () => {
    it('rejects if not in a guild', async () => {
      const playerManager = { stop: vi.fn() } as unknown as GuildPlayerManager;
      const cmd = makeStopCommand(playerManager);
      const reply = vi.fn().mockResolvedValue(undefined);
      const interaction = {
        inGuild: () => false,
        guildId: null,
        reply,
      } as unknown as ChatInputCommandInteraction;

      await cmd.execute(interaction);
      expect(reply).toHaveBeenCalledWith({
        content: '❌ This command can only be used in a server.',
        ephemeral: true,
      });
    });

    it('rejects with ephemeral warning if member is not in same voice channel', async () => {
      const stopMock = vi.fn();
      const playerManager = { stop: stopMock } as unknown as GuildPlayerManager;
      const cmd = makeStopCommand(playerManager);
      const reply = vi.fn().mockResolvedValue(undefined);
      const interaction = {
        inGuild: () => true,
        guildId: 'guild-1',
        member: { voice: { channelId: 'vc-1' } },
        guild: { members: { me: { voice: { channelId: 'vc-2' } } } },
        reply,
      } as unknown as ChatInputCommandInteraction;

      await cmd.execute(interaction);
      expect(reply).toHaveBeenCalledWith({
        content: '🔇 You must be in the same voice channel as Riffly to use this command.',
        ephemeral: true,
      });
      expect(stopMock).not.toHaveBeenCalled();
    });

    it('defers, calls stop, and edits reply with confirmation embed', async () => {
      const stopMock = vi.fn().mockResolvedValue(undefined);
      const playerManager = { stop: stopMock } as unknown as GuildPlayerManager;
      const cmd = makeStopCommand(playerManager);

      const deferReply = vi.fn().mockResolvedValue(undefined);
      const editReply = vi.fn().mockResolvedValue(undefined);
      const interaction = {
        inGuild: () => true,
        guildId: 'guild-1',
        member: { voice: { channelId: 'vc-shared' } },
        guild: { members: { me: { voice: { channelId: 'vc-shared' } } } },
        deferReply,
        editReply,
      } as unknown as ChatInputCommandInteraction;

      await cmd.execute(interaction);
      expect(deferReply).toHaveBeenCalled();
      expect(stopMock).toHaveBeenCalledWith('guild-1');
      expect(editReply).toHaveBeenCalled();
      const callArg = editReply.mock.calls[0]?.[0] as { embeds?: EmbedBuilder[] };
      expect(callArg.embeds?.[0]?.data.title).toBe('⏹️ Stopped');
    });

    it('handles stop errors gracefully', async () => {
      const stopMock = vi.fn().mockRejectedValue(new Error('Internal failure'));
      const playerManager = { stop: stopMock } as unknown as GuildPlayerManager;
      const cmd = makeStopCommand(playerManager);

      const deferReply = vi.fn().mockResolvedValue(undefined);
      const editReply = vi.fn().mockResolvedValue(undefined);
      const interaction = {
        inGuild: () => true,
        guildId: 'guild-1',
        member: { voice: { channelId: 'vc-shared' } },
        guild: { members: { me: { voice: { channelId: 'vc-shared' } } } },
        deferReply,
        editReply,
      } as unknown as ChatInputCommandInteraction;

      await cmd.execute(interaction);
      expect(editReply).toHaveBeenCalledWith('💥 Could not stop.');
    });
  });
});
