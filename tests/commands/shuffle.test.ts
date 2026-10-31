import { describe, expect, it, vi } from 'vitest';
import type { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { makeShuffleCommand } from '../../src/commands/shuffle.js';
import type { GuildPlayerManager } from '../../src/player/guild-player.js';

describe('/shuffle command', () => {
  it('rejects if not executed in a guild', async () => {
    const playerManager = {
      getState: vi.fn(),
      shuffle: vi.fn(),
    } as unknown as GuildPlayerManager;
    const cmd = makeShuffleCommand(playerManager);
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
      shuffle: vi.fn(),
    } as unknown as GuildPlayerManager;
    const cmd = makeShuffleCommand(playerManager);
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

  it('rejects with notice when queue has fewer than 2 upcoming tracks', async () => {
    const shuffleMock = vi.fn();
    const playerManager = {
      getState: vi.fn().mockReturnValue({
        upcoming: [{ title: 'Single track' }],
      }),
      shuffle: shuffleMock,
    } as unknown as GuildPlayerManager;
    const cmd = makeShuffleCommand(playerManager);

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
    expect(editReply).toHaveBeenCalledWith(
      '🔀 Need at least 2 upcoming tracks in the queue to shuffle.',
    );
    expect(shuffleMock).not.toHaveBeenCalled();
  });

  it('calls playerManager.shuffle and sends confirmation embed when queue has >= 2 tracks', async () => {
    const shuffleMock = vi.fn();
    const playerManager = {
      getState: vi.fn().mockReturnValue({
        upcoming: [{ title: 'Track 1' }, { title: 'Track 2' }, { title: 'Track 3' }],
      }),
      shuffle: shuffleMock,
    } as unknown as GuildPlayerManager;
    const cmd = makeShuffleCommand(playerManager);

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
    expect(shuffleMock).toHaveBeenCalledWith('guild-1');
    expect(editReply).toHaveBeenCalled();
    const callArg = editReply.mock.calls[0]?.[0] as { embeds?: EmbedBuilder[] };
    expect(callArg.embeds?.[0]?.data.title).toBe('🔀 Queue Shuffled');
    expect(callArg.embeds?.[0]?.data.description).toContain('3');
  });
});
