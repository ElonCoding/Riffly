import { describe, expect, it, vi } from 'vitest';
import type { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { makeLoopCommand } from '../../src/commands/loop.js';
import type { GuildPlayerManager } from '../../src/player/guild-player.js';

describe('/loop command', () => {
  it('rejects if not executed in a server', async () => {
    const playerManager = {
      getState: vi.fn(),
      setLoopMode: vi.fn(),
    } as unknown as GuildPlayerManager;
    const cmd = makeLoopCommand(playerManager);
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

  it('rejects with warning if member is not in bot voice channel', async () => {
    const playerManager = {
      getState: vi.fn(),
      setLoopMode: vi.fn(),
    } as unknown as GuildPlayerManager;
    const cmd = makeLoopCommand(playerManager);
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
  });

  it('reports nothing playing if engine is disconnected or queue is empty', async () => {
    const setLoopModeMock = vi.fn();
    const playerManager = {
      getState: vi.fn().mockReturnValue({
        engineState: 'idle',
        current: undefined,
        upcoming: [],
        loopMode: 'off',
      }),
      setLoopMode: setLoopModeMock,
    } as unknown as GuildPlayerManager;
    const cmd = makeLoopCommand(playerManager);

    const deferReply = vi.fn().mockResolvedValue(undefined);
    const editReply = vi.fn().mockResolvedValue(undefined);

    const interaction = {
      inGuild: () => true,
      guildId: 'guild-1',
      member: { voice: { channelId: 'vc-shared' } },
      guild: { members: { me: { voice: { channelId: 'vc-shared' } } } },
      options: {
        getString: vi.fn().mockReturnValue('track'),
      },
      deferReply,
      editReply,
    } as unknown as ChatInputCommandInteraction;

    await cmd.execute(interaction);
    expect(deferReply).toHaveBeenCalled();
    expect(editReply).toHaveBeenCalledWith('⏹️ Nothing is currently playing.');
    expect(setLoopModeMock).not.toHaveBeenCalled();
  });

  it('sets loop mode to track and sends confirmation embed', async () => {
    const setLoopModeMock = vi.fn().mockReturnValue('track');
    const playerManager = {
      getState: vi.fn().mockReturnValue({
        engineState: 'playing',
        current: { title: 'Song 1' },
        upcoming: [],
        loopMode: 'off',
      }),
      setLoopMode: setLoopModeMock,
    } as unknown as GuildPlayerManager;
    const cmd = makeLoopCommand(playerManager);

    const deferReply = vi.fn().mockResolvedValue(undefined);
    const editReply = vi.fn().mockResolvedValue(undefined);

    const interaction = {
      inGuild: () => true,
      guildId: 'guild-1',
      member: { voice: { channelId: 'vc-shared' } },
      guild: { members: { me: { voice: { channelId: 'vc-shared' } } } },
      options: {
        getString: vi.fn().mockReturnValue('track'),
      },
      deferReply,
      editReply,
    } as unknown as ChatInputCommandInteraction;

    await cmd.execute(interaction);
    expect(setLoopModeMock).toHaveBeenCalledWith('guild-1', 'track');
    expect(editReply).toHaveBeenCalled();
    const callArg = editReply.mock.calls[0]?.[0] as { embeds?: EmbedBuilder[] };
    expect(callArg.embeds?.[0]?.data.title).toContain('Loop Mode Updated');
    expect(callArg.embeds?.[0]?.data.description).toContain('Track');
  });

  it('sets loop mode to queue and sends confirmation embed', async () => {
    const setLoopModeMock = vi.fn().mockReturnValue('queue');
    const playerManager = {
      getState: vi.fn().mockReturnValue({
        engineState: 'playing',
        current: { title: 'Song 1' },
        upcoming: [],
        loopMode: 'track',
      }),
      setLoopMode: setLoopModeMock,
    } as unknown as GuildPlayerManager;
    const cmd = makeLoopCommand(playerManager);

    const deferReply = vi.fn().mockResolvedValue(undefined);
    const editReply = vi.fn().mockResolvedValue(undefined);

    const interaction = {
      inGuild: () => true,
      guildId: 'guild-1',
      member: { voice: { channelId: 'vc-shared' } },
      guild: { members: { me: { voice: { channelId: 'vc-shared' } } } },
      options: {
        getString: vi.fn().mockReturnValue('queue'),
      },
      deferReply,
      editReply,
    } as unknown as ChatInputCommandInteraction;

    await cmd.execute(interaction);
    expect(setLoopModeMock).toHaveBeenCalledWith('guild-1', 'queue');
    expect(editReply).toHaveBeenCalled();
    const callArg = editReply.mock.calls[0]?.[0] as { embeds?: EmbedBuilder[] };
    expect(callArg.embeds?.[0]?.data.description).toContain('Queue');
  });
});
