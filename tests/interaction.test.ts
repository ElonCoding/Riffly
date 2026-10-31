import { describe, expect, it, vi } from 'vitest';
import type { ChatInputCommandInteraction, Interaction } from 'discord.js';
import { handleInteraction } from '../src/interaction.js';
import type { Command } from '../src/commands/types.js';

describe('handleInteraction', () => {
  it('ignores non-chat-input interactions', async () => {
    const fakeInteraction = {
      isChatInputCommand: () => false,
    } as unknown as Interaction;

    await expect(handleInteraction(fakeInteraction, new Map())).resolves.toBeUndefined();
  });

  it('replies ephemeral message for unknown command', async () => {
    const replyMock = vi.fn().mockResolvedValue(undefined);
    const fakeInteraction = {
      isChatInputCommand: () => true,
      commandName: 'unknown',
      isRepliable: () => true,
      replied: false,
      deferred: false,
      reply: replyMock,
    } as unknown as ChatInputCommandInteraction;

    await handleInteraction(fakeInteraction, new Map());

    expect(replyMock).toHaveBeenCalledWith({
      content: 'Unknown command.',
      ephemeral: true,
    });
  });

  it('dispatches to matching command successfully', async () => {
    const executeMock = vi.fn().mockResolvedValue(undefined);
    const fakeCommand: Command = {
      data: {
        name: 'test',
        toJSON: () => ({ name: 'test', description: 'test command' }),
      },
      execute: executeMock,
    };

    const fakeInteraction = {
      isChatInputCommand: () => true,
      commandName: 'test',
    } as unknown as ChatInputCommandInteraction;

    const commands = new Map<string, Command>([['test', fakeCommand]]);
    await handleInteraction(fakeInteraction, commands);

    expect(executeMock).toHaveBeenCalledWith(fakeInteraction);
  });

  it('catches execution error and replies with user error', async () => {
    const executeMock = vi.fn().mockRejectedValue(new Error('Boom'));
    const replyMock = vi.fn().mockResolvedValue(undefined);

    const fakeCommand: Command = {
      data: {
        name: 'fail',
        toJSON: () => ({ name: 'fail', description: 'failing command' }),
      },
      execute: executeMock,
    };

    const fakeInteraction = {
      isChatInputCommand: () => true,
      commandName: 'fail',
      isRepliable: () => true,
      replied: false,
      deferred: false,
      reply: replyMock,
    } as unknown as ChatInputCommandInteraction;

    const commands = new Map<string, Command>([['fail', fakeCommand]]);
    await handleInteraction(fakeInteraction, commands);

    expect(replyMock).toHaveBeenCalledWith({
      content: 'There was an error while executing this command.',
      ephemeral: true,
    });
  });

  it('uses followUp if interaction is already deferred/replied on error', async () => {
    const executeMock = vi.fn().mockRejectedValue(new Error('Async error'));
    const followUpMock = vi.fn().mockResolvedValue(undefined);

    const fakeCommand: Command = {
      data: {
        name: 'asyncfail',
        toJSON: () => ({ name: 'asyncfail', description: 'async failing' }),
      },
      execute: executeMock,
    };

    const fakeInteraction = {
      isChatInputCommand: () => true,
      commandName: 'asyncfail',
      isRepliable: () => true,
      replied: true,
      deferred: false,
      followUp: followUpMock,
    } as unknown as ChatInputCommandInteraction;

    const commands = new Map<string, Command>([['asyncfail', fakeCommand]]);
    await handleInteraction(fakeInteraction, commands);

    expect(followUpMock).toHaveBeenCalledWith({
      content: 'There was an error while executing this command.',
      ephemeral: true,
    });
  });

  describe('button interactions', () => {
    it('ignores buttons with non-riffly customId', async () => {
      const fakeInteraction = {
        isChatInputCommand: () => false,
        isButton: () => true,
        customId: 'other_button',
      } as unknown as Interaction;

      await expect(handleInteraction(fakeInteraction, new Map())).resolves.toBeUndefined();
    });

    it('rejects button if not in a guild', async () => {
      const replyMock = vi.fn().mockResolvedValue(undefined);
      const fakeInteraction = {
        isChatInputCommand: () => false,
        isButton: () => true,
        customId: 'riffly_pause',
        inGuild: () => false,
        guildId: null,
        isRepliable: () => true,
        replied: false,
        deferred: false,
        reply: replyMock,
      } as unknown as Interaction;

      await handleInteraction(fakeInteraction, new Map());
      expect(replyMock).toHaveBeenCalledWith({
        content: '❌ Controls can only be used in a server.',
        ephemeral: true,
      });
    });

    it('rejects button if user is not in the same voice channel as Riffly', async () => {
      const replyMock = vi.fn().mockResolvedValue(undefined);
      const fakeInteraction = {
        isChatInputCommand: () => false,
        isButton: () => true,
        customId: 'riffly_pause',
        inGuild: () => true,
        guildId: 'guild-1',
        member: { voice: { channelId: 'vc-user' } },
        guild: { members: { me: { voice: { channelId: 'vc-bot' } } } },
        isRepliable: () => true,
        replied: false,
        deferred: false,
        reply: replyMock,
      } as unknown as Interaction;

      await handleInteraction(fakeInteraction, new Map());
      expect(replyMock).toHaveBeenCalledWith({
        content: '🔇 You must be in the same voice channel as Riffly to use this control.',
        ephemeral: true,
      });
    });

    it('routes riffly_pause to playerManager.pause and defers update', async () => {
      const pauseMock = vi.fn().mockResolvedValue(undefined);
      const deferUpdateMock = vi.fn().mockResolvedValue(undefined);
      const playerManager = { pause: pauseMock } as unknown as import('../src/player/guild-player.js').GuildPlayerManager;

      const fakeInteraction = {
        isChatInputCommand: () => false,
        isButton: () => true,
        customId: 'riffly_pause',
        inGuild: () => true,
        guildId: 'guild-1',
        member: { voice: { channelId: 'vc-shared' } },
        guild: { members: { me: { voice: { channelId: 'vc-shared' } } } },
        deferred: false,
        replied: false,
        deferUpdate: deferUpdateMock,
      } as unknown as Interaction;

      await handleInteraction(fakeInteraction, new Map(), playerManager);
      expect(pauseMock).toHaveBeenCalledWith('guild-1');
      expect(deferUpdateMock).toHaveBeenCalled();
    });

    it('routes riffly_resume to playerManager.resume and defers update', async () => {
      const resumeMock = vi.fn().mockResolvedValue(undefined);
      const deferUpdateMock = vi.fn().mockResolvedValue(undefined);
      const playerManager = { resume: resumeMock } as unknown as import('../src/player/guild-player.js').GuildPlayerManager;

      const fakeInteraction = {
        isChatInputCommand: () => false,
        isButton: () => true,
        customId: 'riffly_resume',
        inGuild: () => true,
        guildId: 'guild-1',
        member: { voice: { channelId: 'vc-shared' } },
        guild: { members: { me: { voice: { channelId: 'vc-shared' } } } },
        deferred: false,
        replied: false,
        deferUpdate: deferUpdateMock,
      } as unknown as Interaction;

      await handleInteraction(fakeInteraction, new Map(), playerManager);
      expect(resumeMock).toHaveBeenCalledWith('guild-1');
      expect(deferUpdateMock).toHaveBeenCalled();
    });

    it('routes riffly_skip to playerManager.skip and defers update', async () => {
      const skipMock = vi.fn().mockResolvedValue(undefined);
      const deferUpdateMock = vi.fn().mockResolvedValue(undefined);
      const playerManager = { skip: skipMock } as unknown as import('../src/player/guild-player.js').GuildPlayerManager;

      const fakeInteraction = {
        isChatInputCommand: () => false,
        isButton: () => true,
        customId: 'riffly_skip',
        inGuild: () => true,
        guildId: 'guild-1',
        member: { voice: { channelId: 'vc-shared' } },
        guild: { members: { me: { voice: { channelId: 'vc-shared' } } } },
        deferred: false,
        replied: false,
        deferUpdate: deferUpdateMock,
      } as unknown as Interaction;

      await handleInteraction(fakeInteraction, new Map(), playerManager);
      expect(skipMock).toHaveBeenCalledWith('guild-1');
      expect(deferUpdateMock).toHaveBeenCalled();
    });

    it('routes riffly_stop to playerManager.stop and defers update', async () => {
      const stopMock = vi.fn().mockResolvedValue(undefined);
      const deferUpdateMock = vi.fn().mockResolvedValue(undefined);
      const playerManager = { stop: stopMock } as unknown as import('../src/player/guild-player.js').GuildPlayerManager;

      const fakeInteraction = {
        isChatInputCommand: () => false,
        isButton: () => true,
        customId: 'riffly_stop',
        inGuild: () => true,
        guildId: 'guild-1',
        member: { voice: { channelId: 'vc-shared' } },
        guild: { members: { me: { voice: { channelId: 'vc-shared' } } } },
        deferred: false,
        replied: false,
        deferUpdate: deferUpdateMock,
      } as unknown as Interaction;

      await handleInteraction(fakeInteraction, new Map(), playerManager);
      expect(stopMock).toHaveBeenCalledWith('guild-1');
      expect(deferUpdateMock).toHaveBeenCalled();
    });

    it('routes riffly_loop and cycles loop mode correctly', async () => {
      const setLoopModeMock = vi.fn();
      const deferUpdateMock = vi.fn().mockResolvedValue(undefined);
      const playerManager = {
        getState: vi.fn().mockReturnValue({ loopMode: 'off' }),
        setLoopMode: setLoopModeMock,
      } as unknown as import('../src/player/guild-player.js').GuildPlayerManager;

      const fakeInteraction = {
        isChatInputCommand: () => false,
        isButton: () => true,
        customId: 'riffly_loop',
        inGuild: () => true,
        guildId: 'guild-1',
        member: { voice: { channelId: 'vc-shared' } },
        guild: { members: { me: { voice: { channelId: 'vc-shared' } } } },
        deferred: false,
        replied: false,
        deferUpdate: deferUpdateMock,
      } as unknown as Interaction;

      await handleInteraction(fakeInteraction, new Map(), playerManager);
      expect(setLoopModeMock).toHaveBeenCalledWith('guild-1', 'track');
      expect(deferUpdateMock).toHaveBeenCalled();
    });

    it('routes riffly_shuffle and validates queue length', async () => {
      const shuffleMock = vi.fn();
      const replyMock = vi.fn().mockResolvedValue(undefined);
      const deferUpdateMock = vi.fn().mockResolvedValue(undefined);

      // Case 1: insufficient tracks
      const pmLow = {
        getState: vi.fn().mockReturnValue({ upcoming: [{ title: 'Only one' }] }),
        shuffle: shuffleMock,
      } as unknown as import('../src/player/guild-player.js').GuildPlayerManager;

      const fakeInteraction1 = {
        isChatInputCommand: () => false,
        isButton: () => true,
        customId: 'riffly_shuffle',
        inGuild: () => true,
        guildId: 'guild-1',
        member: { voice: { channelId: 'vc-shared' } },
        guild: { members: { me: { voice: { channelId: 'vc-shared' } } } },
        isRepliable: () => true,
        deferred: false,
        replied: false,
        reply: replyMock,
        deferUpdate: deferUpdateMock,
      } as unknown as Interaction;

      await handleInteraction(fakeInteraction1, new Map(), pmLow);
      expect(replyMock).toHaveBeenCalledWith({
        content: '🔀 Need at least 2 tracks in the queue to shuffle.',
        ephemeral: true,
      });
      expect(shuffleMock).not.toHaveBeenCalled();

      // Case 2: sufficient tracks
      const pmReady = {
        getState: vi.fn().mockReturnValue({ upcoming: [{ title: 'Track 1' }, { title: 'Track 2' }] }),
        shuffle: shuffleMock,
      } as unknown as import('../src/player/guild-player.js').GuildPlayerManager;

      const fakeInteraction2 = {
        isChatInputCommand: () => false,
        isButton: () => true,
        customId: 'riffly_shuffle',
        inGuild: () => true,
        guildId: 'guild-1',
        member: { voice: { channelId: 'vc-shared' } },
        guild: { members: { me: { voice: { channelId: 'vc-shared' } } } },
        deferred: false,
        replied: false,
        deferUpdate: deferUpdateMock,
      } as unknown as Interaction;

      await handleInteraction(fakeInteraction2, new Map(), pmReady);
      expect(shuffleMock).toHaveBeenCalledWith('guild-1');
      expect(deferUpdateMock).toHaveBeenCalled();
    });

    it('catches button execution error and sends user-friendly feedback', async () => {
      const pauseMock = vi.fn().mockRejectedValue(new Error('Lavalink failed'));
      const replyMock = vi.fn().mockResolvedValue(undefined);
      const playerManager = { pause: pauseMock } as unknown as import('../src/player/guild-player.js').GuildPlayerManager;

      const fakeInteraction = {
        isChatInputCommand: () => false,
        isButton: () => true,
        customId: 'riffly_pause',
        inGuild: () => true,
        guildId: 'guild-1',
        member: { voice: { channelId: 'vc-shared' } },
        guild: { members: { me: { voice: { channelId: 'vc-shared' } } } },
        isRepliable: () => true,
        deferred: false,
        replied: false,
        reply: replyMock,
      } as unknown as Interaction;

      await handleInteraction(fakeInteraction, new Map(), playerManager);
      expect(replyMock).toHaveBeenCalledWith({
        content: '❌ Lavalink failed',
        ephemeral: true,
      });
    });
  });
});
