import { describe, expect, it, vi } from 'vitest';
import type { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { makeQueueCommand } from '../../src/commands/queue.js';
import type { GuildPlayerManager } from '../../src/player/guild-player.js';

describe('/queue command', () => {
  it('rejects if not executed in a server', async () => {
    const playerManager = {
      getState: vi.fn(),
    } as unknown as GuildPlayerManager;
    const cmd = makeQueueCommand(playerManager);
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

  it('reports empty queue when no track is playing and upcoming is empty', async () => {
    const playerManager = {
      getState: vi.fn().mockReturnValue({
        current: undefined,
        upcoming: [],
        loopMode: 'off',
      }),
    } as unknown as GuildPlayerManager;
    const cmd = makeQueueCommand(playerManager);

    const deferReply = vi.fn().mockResolvedValue(undefined);
    const editReply = vi.fn().mockResolvedValue(undefined);

    const interaction = {
      inGuild: () => true,
      guildId: 'guild-1',
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

  it('renders queue with current playing track, paginated upcoming tracks, and total duration', async () => {
    const currentTrack = {
      title: 'Current Song',
      author: 'Current Artist',
      lengthMs: 120_000,
      uri: 'https://soundcloud.com/current',
      isStream: false,
    };

    const upcomingTracks = Array.from({ length: 15 }, (_, i) => ({
      title: `Upcoming Song ${i + 1}`,
      author: `Artist ${i + 1}`,
      lengthMs: 60_000,
      uri: `https://soundcloud.com/track-${i + 1}`,
      isStream: false,
    }));

    const playerManager = {
      getState: vi.fn().mockReturnValue({
        engineState: 'playing',
        current: currentTrack,
        upcoming: upcomingTracks,
        loopMode: 'queue',
      }),
    } as unknown as GuildPlayerManager;
    const cmd = makeQueueCommand(playerManager);

    const deferReply = vi.fn().mockResolvedValue(undefined);
    const editReply = vi.fn().mockResolvedValue(undefined);

    // Request page 1
    const interaction = {
      inGuild: () => true,
      guildId: 'guild-1',
      options: {
        getInteger: vi.fn().mockReturnValue(1),
      },
      deferReply,
      editReply,
    } as unknown as ChatInputCommandInteraction;

    await cmd.execute(interaction);
    expect(deferReply).toHaveBeenCalled();
    expect(editReply).toHaveBeenCalled();

    const callArg = editReply.mock.calls[0]?.[0] as { embeds?: EmbedBuilder[] };
    expect(callArg.embeds).toBeDefined();
    const embed = callArg.embeds?.[0];
    expect(embed?.data.title).toBe('📋 Queue');
    expect(embed?.data.description).toContain('Current Song');
    expect(embed?.data.description).toContain('Upcoming Song 1');
    expect(embed?.data.description).toContain('Upcoming Song 10');
    // Page 1 should not have Upcoming Song 11
    expect(embed?.data.description).not.toContain('Upcoming Song 11');

    // Footer should reflect Page 1/2, total tracks (16), and loop mode
    expect(embed?.data.footer?.text).toContain('Page 1/2');
    expect(embed?.data.footer?.text).toContain('16 track(s)');
    expect(embed?.data.footer?.text).toContain('Loop: 🔁 Queue');
  });

  it('renders page 2 correctly when requested', async () => {
    const currentTrack = {
      title: 'Current Song',
      author: 'Current Artist',
      lengthMs: 120_000,
      uri: 'https://soundcloud.com/current',
      isStream: false,
    };

    const upcomingTracks = Array.from({ length: 15 }, (_, i) => ({
      title: `Upcoming Song ${i + 1}`,
      author: `Artist ${i + 1}`,
      lengthMs: 60_000,
      uri: `https://soundcloud.com/track-${i + 1}`,
      isStream: false,
    }));

    const playerManager = {
      getState: vi.fn().mockReturnValue({
        engineState: 'playing',
        current: currentTrack,
        upcoming: upcomingTracks,
        loopMode: 'off',
      }),
    } as unknown as GuildPlayerManager;
    const cmd = makeQueueCommand(playerManager);

    const deferReply = vi.fn().mockResolvedValue(undefined);
    const editReply = vi.fn().mockResolvedValue(undefined);

    // Request page 2
    const interaction = {
      inGuild: () => true,
      guildId: 'guild-1',
      options: {
        getInteger: vi.fn().mockReturnValue(2),
      },
      deferReply,
      editReply,
    } as unknown as ChatInputCommandInteraction;

    await cmd.execute(interaction);
    expect(editReply).toHaveBeenCalled();

    const callArg = editReply.mock.calls[0]?.[0] as { embeds?: EmbedBuilder[] };
    const embed = callArg.embeds?.[0];
    expect(embed?.data.footer?.text).toContain('Page 2/2');
    expect(embed?.data.description).toContain('Upcoming Song 11');
    expect(embed?.data.description).toContain('Upcoming Song 15');
  });
});
