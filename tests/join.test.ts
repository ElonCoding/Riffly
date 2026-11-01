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

  it('calls playerManager.join and edits reply with success when member is in voice', async () => {
    const joinMock = vi.fn().mockResolvedValue(undefined);
    const playerManager = { join: joinMock } as unknown as GuildPlayerManager;
    const command = makeJoinCommand(playerManager);

    const deferReply = vi.fn().mockResolvedValue(undefined);
    const editReply = vi.fn().mockResolvedValue(undefined);
    const fakeInteraction = {
      inGuild: () => true,
      guildId: 'guild-1',
      member: { voice: { channelId: 'vc-123' } },
      deferReply,
      editReply,
    } as unknown as ChatInputCommandInteraction;

    await command.execute(fakeInteraction);
    expect(deferReply).toHaveBeenCalled();
    expect(joinMock).toHaveBeenCalledWith('guild-1', 'vc-123');
    expect(editReply).toHaveBeenCalledWith('🔊 Joined <#vc-123>!');
  });

  it('edits reply with user message on join error', async () => {
    const joinMock = vi.fn().mockRejectedValue(new Error('Connection timed out'));
    const playerManager = { join: joinMock } as unknown as GuildPlayerManager;
    const command = makeJoinCommand(playerManager);

    const deferReply = vi.fn().mockResolvedValue(undefined);
    const editReply = vi.fn().mockResolvedValue(undefined);
    const fakeInteraction = {
      inGuild: () => true,
      guildId: 'guild-1',
      member: { voice: { channelId: 'vc-123' } },
      deferReply,
      editReply,
    } as unknown as ChatInputCommandInteraction;

    await command.execute(fakeInteraction);
    expect(deferReply).toHaveBeenCalled();
    expect(editReply).toHaveBeenCalledWith('💥 Failed to join voice channel.');
  });

  it('rejects with voicePermissionDenied userMessage when bot lacks voice permissions', async () => {
    const joinMock = vi.fn();
    const playerManager = { join: joinMock } as unknown as GuildPlayerManager;
    const command = makeJoinCommand(playerManager);

    const deferReply = vi.fn().mockResolvedValue(undefined);
    const editReply = vi.fn().mockResolvedValue(undefined);
    const fakeInteraction = {
      inGuild: () => true,
      guildId: 'guild-1',
      member: { voice: { channelId: 'vc-123' } },
      guild: {
        members: {
          me: {
            permissionsIn: vi.fn(() => ({
              has: vi.fn((perm) => (perm === 'Connect' ? false : true)),
            })),
          },
        },
      },
      deferReply,
      editReply,
    } as unknown as ChatInputCommandInteraction;

    await command.execute(fakeInteraction);
    expect(deferReply).toHaveBeenCalled();
    expect(joinMock).not.toHaveBeenCalled();
    expect(editReply).toHaveBeenCalled();
    const message = String(editReply.mock.calls[0]?.[0] ?? '');
    expect(message).toContain('Connect');
  });
});
