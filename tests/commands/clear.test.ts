import { describe, expect, it, vi } from 'vitest';
import type { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { makeClearCommand } from '../../src/commands/clear.js';
import type { GuildPlayerManager } from '../../src/player/guild-player.js';

describe('/clear command', () => {
  it('rejects if not executed in a server', async () => {
    const playerManager = {
      getState: vi.fn(),
      clear: vi.fn(),
    } as unknown as GuildPlayerManager;
    const cmd = makeClearCommand(playerManager);
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
      clear: vi.fn(),
    } as unknown as GuildPlayerManager;
    const cmd = makeClearCommand(playerManager);
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

  it('reports already empty if upcoming queue length is 0', async () => {
    const clearMock = vi.fn();
    const playerManager = {
      getState: vi.fn().mockReturnValue({
        upcoming: [],
      }),
      clear: clearMock,
    } as unknown as GuildPlayerManager;
    const cmd = makeClearCommand(playerManager);

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
    expect(editReply).toHaveBeenCalledWith('📭 The queue is already empty.');
    expect(clearMock).not.toHaveBeenCalled();
  });

  it('clears upcoming tracks and sends confirmation embed', async () => {
    const clearMock = vi.fn();
    const playerManager = {
      getState: vi.fn().mockReturnValue({
        upcoming: [{ title: 'Track 1' }, { title: 'Track 2' }, { title: 'Track 3' }],
      }),
      clear: clearMock,
    } as unknown as GuildPlayerManager;
    const cmd = makeClearCommand(playerManager);

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
    expect(clearMock).toHaveBeenCalledWith('guild-1');
    expect(editReply).toHaveBeenCalled();
    const callArg = editReply.mock.calls[0]?.[0] as { embeds?: EmbedBuilder[] };
    expect(callArg.embeds?.[0]?.data.title).toBe('🧹 Queue Cleared');
    expect(callArg.embeds?.[0]?.data.description).toContain('3');
  });
});
