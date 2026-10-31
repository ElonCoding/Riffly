import { describe, expect, it, vi } from 'vitest';
import type { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { makeSeekCommand } from '../../src/commands/seek.js';
import type { GuildPlayerManager } from '../../src/player/guild-player.js';

describe('/seek command', () => {
  it('rejects if not executed in a server', async () => {
    const playerManager = {
      getState: vi.fn(),
      seek: vi.fn(),
    } as unknown as GuildPlayerManager;
    const cmd = makeSeekCommand(playerManager);
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
    const playerManager = {
      getState: vi.fn(),
      seek: vi.fn(),
    } as unknown as GuildPlayerManager;
    const cmd = makeSeekCommand(playerManager);
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

  it('rejects if nothing is currently playing', async () => {
    const playerManager = {
      getState: vi.fn().mockReturnValue({
        engineState: 'idle',
        current: undefined,
      }),
      seek: vi.fn(),
    } as unknown as GuildPlayerManager;
    const cmd = makeSeekCommand(playerManager);

    const deferReply = vi.fn().mockResolvedValue(undefined);
    const editReply = vi.fn().mockResolvedValue(undefined);

    const interaction = {
      inGuild: () => true,
      guildId: 'guild-1',
      member: { voice: { channelId: 'vc-shared' } },
      guild: { members: { me: { voice: { channelId: 'vc-shared' } } } },
      options: {
        getString: vi.fn().mockReturnValue('1:30'),
      },
      deferReply,
      editReply,
    } as unknown as ChatInputCommandInteraction;

    await cmd.execute(interaction);
    expect(deferReply).toHaveBeenCalled();
    expect(editReply).toHaveBeenCalledWith('⏹️ Nothing is currently playing.');
  });

  it('rejects if track is a livestream or not seekable', async () => {
    const playerManager = {
      getState: vi.fn().mockReturnValue({
        engineState: 'playing',
        current: { title: 'Live Stream', isStream: true, isSeekable: false, lengthMs: 0 },
      }),
      seek: vi.fn(),
    } as unknown as GuildPlayerManager;
    const cmd = makeSeekCommand(playerManager);

    const deferReply = vi.fn().mockResolvedValue(undefined);
    const editReply = vi.fn().mockResolvedValue(undefined);

    const interaction = {
      inGuild: () => true,
      guildId: 'guild-1',
      member: { voice: { channelId: 'vc-shared' } },
      guild: { members: { me: { voice: { channelId: 'vc-shared' } } } },
      options: {
        getString: vi.fn().mockReturnValue('1:30'),
      },
      deferReply,
      editReply,
    } as unknown as ChatInputCommandInteraction;

    await cmd.execute(interaction);
    expect(editReply).toHaveBeenCalledWith('🚫 This track does not support seeking.');
  });

  it('rejects when timestamp format is invalid', async () => {
    const playerManager = {
      getState: vi.fn().mockReturnValue({
        engineState: 'playing',
        current: { title: 'Track', isStream: false, isSeekable: true, lengthMs: 200_000 },
      }),
      seek: vi.fn(),
    } as unknown as GuildPlayerManager;
    const cmd = makeSeekCommand(playerManager);

    const deferReply = vi.fn().mockResolvedValue(undefined);
    const editReply = vi.fn().mockResolvedValue(undefined);

    const interaction = {
      inGuild: () => true,
      guildId: 'guild-1',
      member: { voice: { channelId: 'vc-shared' } },
      guild: { members: { me: { voice: { channelId: 'vc-shared' } } } },
      options: {
        getString: vi.fn().mockReturnValue('invalid-time'),
      },
      deferReply,
      editReply,
    } as unknown as ChatInputCommandInteraction;

    await cmd.execute(interaction);
    expect(editReply).toHaveBeenCalledWith(
      '❌ Invalid timestamp format. Use e.g. `1:30`, `90s`, `1m30s`, or seconds.',
    );
  });

  it('rejects when timestamp exceeds track duration', async () => {
    const playerManager = {
      getState: vi.fn().mockReturnValue({
        engineState: 'playing',
        current: { title: 'Track', isStream: false, isSeekable: true, lengthMs: 60_000 },
      }),
      seek: vi.fn(),
    } as unknown as GuildPlayerManager;
    const cmd = makeSeekCommand(playerManager);

    const deferReply = vi.fn().mockResolvedValue(undefined);
    const editReply = vi.fn().mockResolvedValue(undefined);

    const interaction = {
      inGuild: () => true,
      guildId: 'guild-1',
      member: { voice: { channelId: 'vc-shared' } },
      guild: { members: { me: { voice: { channelId: 'vc-shared' } } } },
      options: {
        getString: vi.fn().mockReturnValue('2:00'),
      },
      deferReply,
      editReply,
    } as unknown as ChatInputCommandInteraction;

    await cmd.execute(interaction);
    expect(editReply).toHaveBeenCalledWith(
      expect.stringContaining('Seek position exceeds track duration'),
    );
  });

  it('seeks to position and sends confirmation embed', async () => {
    const seekMock = vi.fn().mockResolvedValue(undefined);
    const playerManager = {
      getState: vi.fn().mockReturnValue({
        engineState: 'playing',
        current: { title: 'Track', isStream: false, isSeekable: true, lengthMs: 180_000 },
      }),
      seek: seekMock,
    } as unknown as GuildPlayerManager;
    const cmd = makeSeekCommand(playerManager);

    const deferReply = vi.fn().mockResolvedValue(undefined);
    const editReply = vi.fn().mockResolvedValue(undefined);

    const interaction = {
      inGuild: () => true,
      guildId: 'guild-1',
      member: { voice: { channelId: 'vc-shared' } },
      guild: { members: { me: { voice: { channelId: 'vc-shared' } } } },
      options: {
        getString: vi.fn().mockReturnValue('1:30'),
      },
      deferReply,
      editReply,
    } as unknown as ChatInputCommandInteraction;

    await cmd.execute(interaction);
    expect(seekMock).toHaveBeenCalledWith('guild-1', 90_000);
    expect(editReply).toHaveBeenCalled();
    const callArg = editReply.mock.calls[0]?.[0] as { embeds?: EmbedBuilder[] };
    expect(callArg.embeds?.[0]?.data.title).toBe('⏩ Position Updated');
    expect(callArg.embeds?.[0]?.data.description).toContain('1:30');
  });
});

