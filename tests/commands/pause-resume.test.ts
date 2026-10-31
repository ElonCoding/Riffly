import { describe, expect, it, vi } from 'vitest';
import type { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { makePauseCommand } from '../../src/commands/pause.js';
import { makeResumeCommand } from '../../src/commands/resume.js';
import type { GuildPlayerManager } from '../../src/player/guild-player.js';
import { RifflyError } from '../../src/errors.js';

describe('pause and resume commands', () => {
  describe('makePauseCommand', () => {
    it('rejects if not in guild', async () => {
      const playerManager = { pause: vi.fn() } as unknown as GuildPlayerManager;
      const cmd = makePauseCommand(playerManager);
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

    it('rejects with ephemeral warning if member is not in bot voice channel', async () => {
      const pauseMock = vi.fn();
      const playerManager = { pause: pauseMock } as unknown as GuildPlayerManager;
      const cmd = makePauseCommand(playerManager);
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
      expect(pauseMock).not.toHaveBeenCalled();
    });

    it('defers, calls pause, and edits reply with embed when successful', async () => {
      const pauseMock = vi.fn().mockResolvedValue(undefined);
      const playerManager = { pause: pauseMock } as unknown as GuildPlayerManager;
      const cmd = makePauseCommand(playerManager);

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
      expect(pauseMock).toHaveBeenCalledWith('guild-1');
      expect(editReply).toHaveBeenCalled();
      const callArg = editReply.mock.calls[0]?.[0] as { embeds?: EmbedBuilder[] };
      expect(callArg.embeds?.[0]?.data.title).toBe('⏸️ Paused');
    });

    it('handles alreadyPaused error gracefully with friendly message', async () => {
      const pauseMock = vi.fn().mockRejectedValue(RifflyError.alreadyPaused());
      const playerManager = { pause: pauseMock } as unknown as GuildPlayerManager;
      const cmd = makePauseCommand(playerManager);

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
      expect(editReply).toHaveBeenCalledWith('⏸️ Playback is already paused.');
    });
  });

  describe('makeResumeCommand', () => {
    it('rejects if not in guild', async () => {
      const playerManager = { resume: vi.fn() } as unknown as GuildPlayerManager;
      const cmd = makeResumeCommand(playerManager);
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

    it('rejects with ephemeral warning if member is not in bot voice channel', async () => {
      const resumeMock = vi.fn();
      const playerManager = { resume: resumeMock } as unknown as GuildPlayerManager;
      const cmd = makeResumeCommand(playerManager);
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
      expect(resumeMock).not.toHaveBeenCalled();
    });

    it('defers, calls resume, and edits reply with embed when successful', async () => {
      const resumeMock = vi.fn().mockResolvedValue(undefined);
      const playerManager = { resume: resumeMock } as unknown as GuildPlayerManager;
      const cmd = makeResumeCommand(playerManager);

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
      expect(resumeMock).toHaveBeenCalledWith('guild-1');
      expect(editReply).toHaveBeenCalled();
      const callArg = editReply.mock.calls[0]?.[0] as { embeds?: EmbedBuilder[] };
      expect(callArg.embeds?.[0]?.data.title).toBe('▶️ Resumed');
    });

    it('handles notPaused error gracefully with friendly message', async () => {
      const resumeMock = vi.fn().mockRejectedValue(RifflyError.notPaused());
      const playerManager = { resume: resumeMock } as unknown as GuildPlayerManager;
      const cmd = makeResumeCommand(playerManager);

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
      expect(editReply).toHaveBeenCalledWith('▶️ Playback is not paused.');
    });
  });
});
