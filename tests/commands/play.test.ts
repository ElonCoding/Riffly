import { describe, expect, it, vi } from 'vitest';
import type { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { makePlayCommand } from '../../src/commands/play.js';
import type { GuildPlayerManager } from '../../src/player/guild-player.js';
import type { ResolveResult, TrackResolver } from '../../src/provider/resolver.js';
import type { Track } from '../../src/audio/types.js';

describe('makePlayCommand', () => {
  const sampleTrack: Track = {
    encoded: 'encoded-track-1',
    title: 'Test Song',
    author: 'Test Artist',
    lengthMs: 215000,
    identifier: 'id-1',
    isSeekable: true,
    isStream: false,
    uri: 'https://soundcloud.com/test/song',
    artworkUrl: 'https://example.com/art.jpg',
  };

  const samplePlaylistTracks: Track[] = [
    sampleTrack,
    {
      encoded: 'encoded-track-2',
      title: 'Second Song',
      author: 'Test Artist',
      lengthMs: 180000,
      identifier: 'id-2',
      isSeekable: true,
      isStream: false,
    },
  ];

  it('rejects with error if input validation fails (e.g. empty)', async () => {
    const joinMock = vi.fn();
    const playerManager = { join: joinMock, play: vi.fn() } as unknown as GuildPlayerManager;
    const resolver = { resolve: vi.fn() } as unknown as TrackResolver;
    const cmd = makePlayCommand(playerManager, resolver);

    const deferReply = vi.fn().mockResolvedValue(undefined);
    const editReply = vi.fn().mockResolvedValue(undefined);
    const interaction = {
      inGuild: () => true,
      guildId: 'guild-1',
      options: { getString: () => '   ' },
      deferReply,
      editReply,
    } as unknown as ChatInputCommandInteraction;

    await cmd.execute(interaction);
    expect(deferReply).toHaveBeenCalled();
    expect(editReply).toHaveBeenCalledWith('❌ Please provide a search query or URL.');
    expect(joinMock).not.toHaveBeenCalled();
  });

  it('rejects if member is not in a voice channel', async () => {
    const joinMock = vi.fn();
    const playerManager = { join: joinMock, play: vi.fn() } as unknown as GuildPlayerManager;
    const resolver = { resolve: vi.fn() } as unknown as TrackResolver;
    const cmd = makePlayCommand(playerManager, resolver);

    const deferReply = vi.fn().mockResolvedValue(undefined);
    const editReply = vi.fn().mockResolvedValue(undefined);
    const interaction = {
      inGuild: () => true,
      guildId: 'guild-1',
      member: { voice: { channelId: null } },
      options: { getString: () => 'valid song' },
      deferReply,
      editReply,
    } as unknown as ChatInputCommandInteraction;

    await cmd.execute(interaction);
    expect(editReply).toHaveBeenCalledWith('🔇 You must be in a voice channel to use this.');
    expect(joinMock).not.toHaveBeenCalled();
  });

  it('rejects if bot is already connected to a different voice channel', async () => {
    const joinMock = vi.fn();
    const playerManager = { join: joinMock, play: vi.fn() } as unknown as GuildPlayerManager;
    const resolver = { resolve: vi.fn() } as unknown as TrackResolver;
    const cmd = makePlayCommand(playerManager, resolver);

    const deferReply = vi.fn().mockResolvedValue(undefined);
    const editReply = vi.fn().mockResolvedValue(undefined);
    const interaction = {
      inGuild: () => true,
      guildId: 'guild-1',
      member: { voice: { channelId: 'vc-user' } },
      guild: { members: { me: { voice: { channelId: 'vc-bot' } } } },
      options: { getString: () => 'valid song' },
      deferReply,
      editReply,
    } as unknown as ChatInputCommandInteraction;

    await cmd.execute(interaction);
    expect(editReply).toHaveBeenCalledWith(
      '🔇 You must be in the same voice channel as Riffly to play music.',
    );
    expect(joinMock).not.toHaveBeenCalled();
  });

  it('resolves track, enqueues, and presents single track embed', async () => {
    const joinMock = vi.fn().mockResolvedValue(undefined);
    const playMock = vi.fn().mockResolvedValue({ started: true });
    const playerManager = { join: joinMock, play: playMock } as unknown as GuildPlayerManager;

    const resolveResult: ResolveResult = {
      tracks: [sampleTrack],
      summary: '**Test Song** by Test Artist',
    };
    const resolveMock = vi.fn().mockResolvedValue(resolveResult);
    const resolver = { resolve: resolveMock } as unknown as TrackResolver;

    const cmd = makePlayCommand(playerManager, resolver);

    const deferReply = vi.fn().mockResolvedValue(undefined);
    const editReply = vi.fn().mockResolvedValue(undefined);
    const interaction = {
      inGuild: () => true,
      guildId: 'guild-1',
      member: { voice: { channelId: 'vc-user' } },
      guild: { members: { me: { voice: { channelId: null } } } },
      options: { getString: () => 'Test Song' },
      deferReply,
      editReply,
    } as unknown as ChatInputCommandInteraction;

    await cmd.execute(interaction);
    expect(deferReply).toHaveBeenCalled();
    expect(joinMock).toHaveBeenCalledWith('guild-1', 'vc-user');
    expect(resolveMock).toHaveBeenCalledWith('Test Song');
    expect(playMock).toHaveBeenCalledWith('guild-1', [sampleTrack]);

    expect(editReply).toHaveBeenCalled();
    const callArg = editReply.mock.calls[0]?.[0] as { embeds?: EmbedBuilder[] };
    expect(callArg.embeds?.[0]?.data.title).toBe('▶️ Now Playing');
    expect(callArg.embeds?.[0]?.data.description).toContain('Test Song');
  });

  it('resolves playlist, enqueues, and presents playlist embed', async () => {
    const joinMock = vi.fn().mockResolvedValue(undefined);
    const playMock = vi.fn().mockResolvedValue({ started: false });
    const playerManager = { join: joinMock, play: playMock } as unknown as GuildPlayerManager;

    const resolveResult: ResolveResult = {
      tracks: samplePlaylistTracks,
      summary: 'Playlist **My Favorites** — 2 tracks',
    };
    const resolveMock = vi.fn().mockResolvedValue(resolveResult);
    const resolver = { resolve: resolveMock } as unknown as TrackResolver;

    const cmd = makePlayCommand(playerManager, resolver);

    const deferReply = vi.fn().mockResolvedValue(undefined);
    const editReply = vi.fn().mockResolvedValue(undefined);
    const interaction = {
      inGuild: () => true,
      guildId: 'guild-1',
      member: { voice: { channelId: 'vc-user' } },
      guild: { members: { me: { voice: { channelId: 'vc-user' } } } },
      options: { getString: () => 'https://soundcloud.com/test/sets/my-favorites' },
      deferReply,
      editReply,
    } as unknown as ChatInputCommandInteraction;

    await cmd.execute(interaction);
    expect(deferReply).toHaveBeenCalled();
    expect(playMock).toHaveBeenCalledWith('guild-1', samplePlaylistTracks);

    const callArg = editReply.mock.calls[0]?.[0] as { embeds?: EmbedBuilder[] };
    expect(callArg.embeds?.[0]?.data.title).toBe('📋 Playlist Enqueued');
    expect(callArg.embeds?.[0]?.data.description).toContain('My Favorites');
  });

  it('rejects with voicePermissionDenied userMessage when bot lacks voice permissions', async () => {
    const joinMock = vi.fn();
    const playMock = vi.fn();
    const playerManager = { join: joinMock, play: playMock } as unknown as GuildPlayerManager;
    const resolver = { resolve: vi.fn() } as unknown as TrackResolver;

    const cmd = makePlayCommand(playerManager, resolver);

    const deferReply = vi.fn().mockResolvedValue(undefined);
    const editReply = vi.fn().mockResolvedValue(undefined);
    const interaction = {
      inGuild: () => true,
      guildId: 'guild-1',
      member: { voice: { channelId: 'vc-user' } },
      guild: {
        members: {
          me: {
            voice: { channelId: null },
            permissionsIn: vi.fn(() => ({
              has: vi.fn((perm) => (perm === 'Speak' ? false : true)),
            })),
          },
        },
      },
      options: { getString: () => 'Test Song' },
      deferReply,
      editReply,
    } as unknown as ChatInputCommandInteraction;

    await cmd.execute(interaction);
    expect(deferReply).toHaveBeenCalled();
    expect(joinMock).not.toHaveBeenCalled();
    expect(editReply).toHaveBeenCalled();
    const message = String(editReply.mock.calls[0]?.[0] ?? '');
    expect(message).toContain('Speak');
  });
});
