import { describe, expect, it, vi } from 'vitest';
import type { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { makeRemoveCommand } from '../../src/commands/remove.js';
import type { GuildPlayerManager } from '../../src/player/guild-player.js';

describe('/remove command', () => {
  it('rejects if not executed in a server', async () => {
    const playerManager = {
      getState: vi.fn(),
      remove: vi.fn(),
    } as unknown as GuildPlayerManager;
    const cmd = makeRemoveCommand(playerManager);
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
      remove: vi.fn(),
    } as unknown as GuildPlayerManager;
    const cmd = makeRemoveCommand(playerManager);
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

  it('rejects if the queue is empty', async () => {
    const playerManager = {
      getState: vi.fn().mockReturnValue({
        upcoming: [],
      }),
      remove: vi.fn(),
    } as unknown as GuildPlayerManager;
    const cmd = makeRemoveCommand(playerManager);

    const deferReply = vi.fn().mockResolvedValue(undefined);
    const editReply = vi.fn().mockResolvedValue(undefined);

    const interaction = {
      inGuild: () => true,
      guildId: 'guild-1',
      member: { voice: { channelId: 'vc-shared' } },
      guild: { members: { me: { voice: { channelId: 'vc-shared' } } } },
      options: {
        getInteger: vi.fn().mockReturnValue(1),
      },
      deferReply,
      editReply,
    } as unknown as ChatInputCommandInteraction;

    await cmd.execute(interaction);
    expect(deferReply).toHaveBeenCalled();
    expect(editReply).toHaveBeenCalledWith('📭 The queue is empty.');
  });

  it('rejects when position is out of queue bounds', async () => {
    const playerManager = {
      getState: vi.fn().mockReturnValue({
        upcoming: [{ title: 'Track 1' }, { title: 'Track 2' }],
      }),
      remove: vi.fn(),
    } as unknown as GuildPlayerManager;
    const cmd = makeRemoveCommand(playerManager);

    const deferReply = vi.fn().mockResolvedValue(undefined);
    const editReply = vi.fn().mockResolvedValue(undefined);

    const interaction = {
      inGuild: () => true,
      guildId: 'guild-1',
      member: { voice: { channelId: 'vc-shared' } },
      guild: { members: { me: { voice: { channelId: 'vc-shared' } } } },
      options: {
        getInteger: vi.fn().mockReturnValue(5),
      },
      deferReply,
      editReply,
    } as unknown as ChatInputCommandInteraction;

    await cmd.execute(interaction);
    expect(editReply).toHaveBeenCalledWith(
      '❌ Invalid track position. Please choose a number between 1 and 2.',
    );
  });

  it('removes track at position and sends confirmation embed', async () => {
    const removeMock = vi.fn().mockReturnValue({
      title: 'Target Track',
      uri: 'https://soundcloud.com/track/123',
    });
    const playerManager = {
      getState: vi.fn().mockReturnValue({
        upcoming: [{ title: 'Target Track' }, { title: 'Other Track' }],
      }),
      remove: removeMock,
    } as unknown as GuildPlayerManager;
    const cmd = makeRemoveCommand(playerManager);

    const deferReply = vi.fn().mockResolvedValue(undefined);
    const editReply = vi.fn().mockResolvedValue(undefined);

    const interaction = {
      inGuild: () => true,
      guildId: 'guild-1',
      member: { voice: { channelId: 'vc-shared' } },
      guild: { members: { me: { voice: { channelId: 'vc-shared' } } } },
      options: {
        getInteger: vi.fn().mockReturnValue(1),
      },
      deferReply,
      editReply,
    } as unknown as ChatInputCommandInteraction;

    await cmd.execute(interaction);
    expect(removeMock).toHaveBeenCalledWith('guild-1', 1);
    expect(editReply).toHaveBeenCalled();
    const callArg = editReply.mock.calls[0]?.[0] as { embeds?: EmbedBuilder[] };
    expect(callArg.embeds?.[0]?.data.title).toBe('🗑️ Track Removed');
    expect(callArg.embeds?.[0]?.data.description).toContain('Target Track');
    expect(callArg.embeds?.[0]?.data.description).toContain('#1');
  });
});

