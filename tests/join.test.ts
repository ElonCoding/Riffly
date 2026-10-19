import { describe, expect, it, vi } from 'vitest';
import type { ChatInputCommandInteraction } from 'discord.js';
import { makeJoinCommand } from '../src/commands/join.js';
import type { GuildPlayerManager } from '../src/player/guild-player.js';

describe('makeJoinCommand', () => {
  it('rejects if interaction is not in a guild', async () => {
    const playerManager = { join: vi.fn() } as unknown as GuildPlayerManager;
    const command = makeJoinCommand(playerManager);

    const reply = vi.fn().mockResolvedValue(undefined);
    const fakeInteraction = {
      inGuild: () => false,
      guildId: null,
      reply,
    } as unknown as ChatInputCommandInteraction;

    await command.execute(fakeInteraction);
    expect(reply).toHaveBeenCalled();
    const callArg = reply.mock.calls[0]?.[0] as { content: string };
    expect(callArg.content).toContain('only be used in a server');
  });

  it('rejects if member is not in a voice channel', async () => {
    const playerManager = { join: vi.fn() } as unknown as GuildPlayerManager;
    const command = makeJoinCommand(playerManager);

    const reply = vi.fn().mockResolvedValue(undefined);
    const fakeInteraction = {
      inGuild: () => true,
      guildId: 'guild-1',
      member: { voice: { channelId: null } },
      reply,
    } as unknown as ChatInputCommandInteraction;

    await command.execute(fakeInteraction);
    expect(reply).toHaveBeenCalled();
    const callArg = reply.mock.calls[0]?.[0] as { content: string };
    expect(callArg.content).toContain('must be in a voice channel');
  });

  it('calls playerManager.join and replies with success when member is in voice', async () => {
    const joinMock = vi.fn().mockResolvedValue(undefined);
    const playerManager = { join: joinMock } as unknown as GuildPlayerManager;
    const command = makeJoinCommand(playerManager);

    const reply = vi.fn().mockResolvedValue(undefined);
    const fakeInteraction = {
      inGuild: () => true,
      guildId: 'guild-1',
      member: { voice: { channelId: 'vc-123' } },
      reply,
    } as unknown as ChatInputCommandInteraction;

    await command.execute(fakeInteraction);
    expect(joinMock).toHaveBeenCalledWith('guild-1', 'vc-123');
    expect(reply).toHaveBeenCalledWith('🔊 Joined <#vc-123>!');
  });
});
