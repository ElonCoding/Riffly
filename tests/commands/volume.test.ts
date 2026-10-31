import { describe, expect, it, vi } from 'vitest';
import type { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { makeVolumeCommand } from '../../src/commands/volume.js';
import type { GuildPlayerManager } from '../../src/player/guild-player.js';

describe('/volume command', () => {
  it('rejects if not executed in a guild', async () => {
    const playerManager = {
      getVolume: vi.fn(),
      setVolume: vi.fn(),
    } as unknown as GuildPlayerManager;
    const cmd = makeVolumeCommand(playerManager);
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

  it('displays current volume if no argument is provided', async () => {
    const getVolumeMock = vi.fn().mockReturnValue(75);
    const playerManager = {
      getVolume: getVolumeMock,
      setVolume: vi.fn(),
    } as unknown as GuildPlayerManager;
    const cmd = makeVolumeCommand(playerManager);
    const reply = vi.fn().mockResolvedValue(undefined);

    const interaction = {
      inGuild: () => true,
      guildId: 'guild-1',
      options: {
        getInteger: vi.fn().mockReturnValue(null),
      },
      reply,
    } as unknown as ChatInputCommandInteraction;

    await cmd.execute(interaction);
    expect(getVolumeMock).toHaveBeenCalledWith('guild-1');
    expect(reply).toHaveBeenCalled();
    const callArg = reply.mock.calls[0]?.[0] as { embeds?: EmbedBuilder[] };
    expect(callArg.embeds?.[0]?.data.title).toBe('🔊 Volume');
    expect(callArg.embeds?.[0]?.data.description).toContain('75%');
  });

  it('rejects with ephemeral warning if member is not in bot voice channel', async () => {
    const setVolumeMock = vi.fn();
    const playerManager = {
      getVolume: vi.fn(),
      setVolume: setVolumeMock,
    } as unknown as GuildPlayerManager;
    const cmd = makeVolumeCommand(playerManager);
    const reply = vi.fn().mockResolvedValue(undefined);

    const interaction = {
      inGuild: () => true,
      guildId: 'guild-1',
      member: { voice: { channelId: 'vc-1' } },
      guild: { members: { me: { voice: { channelId: 'vc-2' } } } },
      options: {
        getInteger: vi.fn().mockReturnValue(50),
      },
      reply,
    } as unknown as ChatInputCommandInteraction;

    await cmd.execute(interaction);
    expect(reply).toHaveBeenCalledWith({
      content: '🔇 You must be in the same voice channel as Riffly to use this command.',
      ephemeral: true,
    });
    expect(setVolumeMock).not.toHaveBeenCalled();
  });

  it('defers reply and updates volume with confirmation embed', async () => {
    const setVolumeMock = vi.fn().mockResolvedValue(undefined);
    const playerManager = {
      setVolume: setVolumeMock,
    } as unknown as GuildPlayerManager;
    const cmd = makeVolumeCommand(playerManager);

    const deferReply = vi.fn().mockResolvedValue(undefined);
    const editReply = vi.fn().mockResolvedValue(undefined);

    const interaction = {
      inGuild: () => true,
      guildId: 'guild-1',
      member: { voice: { channelId: 'vc-shared' } },
      guild: { members: { me: { voice: { channelId: 'vc-shared' } } } },
      options: {
        getInteger: vi.fn().mockReturnValue(40),
      },
      deferReply,
      editReply,
    } as unknown as ChatInputCommandInteraction;

    await cmd.execute(interaction);
    expect(deferReply).toHaveBeenCalled();
    expect(setVolumeMock).toHaveBeenCalledWith('guild-1', 40);
    expect(editReply).toHaveBeenCalled();
    const callArg = editReply.mock.calls[0]?.[0] as { embeds?: EmbedBuilder[] };
    expect(callArg.embeds?.[0]?.data.title).toBe('🔊 Volume Updated');
    expect(callArg.embeds?.[0]?.data.description).toContain('40%');
  });

  it('handles error gracefully when setting volume fails', async () => {
    const setVolumeMock = vi.fn().mockRejectedValue(new Error('Out of bounds'));
    const playerManager = {
      setVolume: setVolumeMock,
    } as unknown as GuildPlayerManager;
    const cmd = makeVolumeCommand(playerManager);

    const deferReply = vi.fn().mockResolvedValue(undefined);
    const editReply = vi.fn().mockResolvedValue(undefined);

    const interaction = {
      inGuild: () => true,
      guildId: 'guild-1',
      member: { voice: { channelId: 'vc-shared' } },
      guild: { members: { me: { voice: { channelId: 'vc-shared' } } } },
      options: {
        getInteger: vi.fn().mockReturnValue(150),
      },
      deferReply,
      editReply,
    } as unknown as ChatInputCommandInteraction;

    await cmd.execute(interaction);
    expect(editReply).toHaveBeenCalledWith('❌ Could not set volume: Out of bounds');
  });
});
