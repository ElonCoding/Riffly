import { describe, expect, it, vi } from 'vitest';
import type {
  ActionRowBuilder,
  ButtonBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import { makeNowPlayingCommand } from '../../src/commands/nowplaying.js';
import type { GuildPlayerManager } from '../../src/player/guild-player.js';

describe('/nowplaying command', () => {
  it('rejects if not executed in a server', async () => {
    const playerManager = {
      getState: vi.fn(),
    } as unknown as GuildPlayerManager;
    const cmd = makeNowPlayingCommand(playerManager);
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

  it('reports nothing playing if engine is idle or disconnected', async () => {
    const playerManager = {
      getState: vi.fn().mockReturnValue({
        engineState: 'idle',
        current: undefined,
        upcoming: [],
        loopMode: 'off',
      }),
    } as unknown as GuildPlayerManager;
    const cmd = makeNowPlayingCommand(playerManager);

    const deferReply = vi.fn().mockResolvedValue(undefined);
    const editReply = vi.fn().mockResolvedValue(undefined);

    const interaction = {
      inGuild: () => true,
      guildId: 'guild-1',
      deferReply,
      editReply,
    } as unknown as ChatInputCommandInteraction;

    await cmd.execute(interaction);
    expect(deferReply).toHaveBeenCalled();
    expect(editReply).toHaveBeenCalledWith('⏹️ Nothing is currently playing.');
  });

  it('renders rich embed, progress bar, artwork, and interactive action row buttons', async () => {
    const track = {
      title: 'Awesome Song',
      author: 'Cool Artist',
      lengthMs: 180_000,
      uri: 'https://soundcloud.com/artist/song',
      artworkUrl: 'https://img.test/art.jpg',
      requesterId: 'user-123',
      isStream: false,
    };

    const playerManager = {
      getState: vi.fn().mockReturnValue({
        engineState: 'playing',
        current: track,
        upcoming: [{ title: 'Next 1' }, { title: 'Next 2' }],
        loopMode: 'track',
      }),
      getPlaybackPosition: vi.fn().mockReturnValue(60_000),
      getVolume: vi.fn().mockReturnValue(80),
    } as unknown as GuildPlayerManager;
    const cmd = makeNowPlayingCommand(playerManager);

    const deferReply = vi.fn().mockResolvedValue(undefined);
    const editReply = vi.fn().mockResolvedValue(undefined);

    const interaction = {
      inGuild: () => true,
      guildId: 'guild-1',
      deferReply,
      editReply,
    } as unknown as ChatInputCommandInteraction;

    await cmd.execute(interaction);
    expect(deferReply).toHaveBeenCalled();
    expect(editReply).toHaveBeenCalled();

    const callArg = editReply.mock.calls[0]?.[0] as {
      embeds?: EmbedBuilder[];
      components?: ActionRowBuilder<ButtonBuilder>[];
    };
    expect(callArg.embeds).toBeDefined();
    const embed = callArg.embeds?.[0];
    expect(embed?.data.title).toBe('🎵 Now Playing');
    expect(embed?.data.description).toContain('Awesome Song');
    expect(embed?.data.description).toContain('🔘'); // progress bar indicator
    expect(embed?.data.thumbnail?.url).toBe('https://img.test/art.jpg');

    // Fields check
    const fields = embed?.data.fields;
    expect(fields?.find((f) => f.name === 'Artist')?.value).toBe('Cool Artist');
    expect(fields?.find((f) => f.name === 'Requested By')?.value).toBe('<@user-123>');
    expect(fields?.find((f) => f.name === 'Volume')?.value).toBe('🔊 80%');
    expect(fields?.find((f) => f.name === 'Loop')?.value).toBe('🔂 Track');
    expect(fields?.find((f) => f.name === 'Status')?.value).toBe('▶️ Playing');

    // Components check (ActionRow with 5 buttons)
    expect(callArg.components).toBeDefined();
    const row = callArg.components?.[0];
    expect(row?.components.length).toBe(5);
    const customIds = row?.components.map((c) => (c.data as { custom_id?: string }).custom_id);
    expect(customIds).toEqual([
      'riffly_pause',
      'riffly_resume',
      'riffly_skip',
      'riffly_stop',
      'riffly_loop',
    ]);
  });
});
