import { describe, expect, it, vi } from 'vitest';
import { PermissionFlagsBits, type ChatInputCommandInteraction, type EmbedBuilder } from 'discord.js';
import { makeMusicDiagCommand, musicDiagCommandData } from '../../src/commands/musicdiag.js';
import type { GuildPlayerManager } from '../../src/player/guild-player.js';
import type { LavalinkMusicEngine } from '../../src/audio/lavalink-engine.js';
import type { Track } from '../../src/audio/types.js';

describe('/musicdiag command', () => {
  const sampleTrack: Track = {
    encoded: 'encoded-test-track',
    title: 'Training Season',
    author: 'Dua Lipa',
    lengthMs: 209000,
    identifier: 'id-123',
    isSeekable: true,
    isStream: false,
    uri: 'https://www.youtube.com/watch?v=3DcoC8p9az8',
  };

  function createMockInteraction(overrides: Record<string, unknown> = {}): ChatInputCommandInteraction {
    const deferReply = vi.fn().mockResolvedValue(undefined);
    const reply = vi.fn().mockResolvedValue(undefined);
    const editReply = vi.fn().mockResolvedValue(undefined);

    return {
      inGuild: () => true,
      guildId: 'guild-1',
      guild: {
        id: 'guild-1',
        members: {
          me: {
            voice: { channel: null },
            permissionsFor: vi.fn(() => ({
              has: vi.fn(() => true),
            })),
          },
        },
      },
      deferReply,
      reply,
      editReply,
      ...overrides,
    } as unknown as ChatInputCommandInteraction;
  }

  function createMockPlayerManager(overrides: Record<string, unknown> = {}): GuildPlayerManager {
    return {
      getState: vi.fn(() => ({
        engineState: 'idle',
        current: undefined,
        upcoming: [],
        loopMode: 'off',
        volume: 100,
        position: 0,
      })),
      getLastError: vi.fn(() => undefined),
      lastPlaybackErrors: new Map(),
      ...overrides,
    } as unknown as GuildPlayerManager;
  }

  function createMockEngine(overrides: Record<string, unknown> = {}): LavalinkMusicEngine {
    const primaryNode = {
      connected: true,
      options: { host: 'localhost', port: 2333 },
      stats: { players: 1, cpu: { lavalinkLoad: 0.05 } },
    };

    return {
      getState: vi.fn(() => 'idle'),
      getPosition: vi.fn(() => 0),
      isBuffering: vi.fn(() => false),
      manager: {
        getPlayer: vi.fn(() => ({
          guildId: 'guild-1',
          connected: true,
          voiceChannelId: 'vc-1',
          track: { encoded: 'enc', info: { title: 'Training Season' } },
        })),
        nodeManager: {
          nodes: new Map([['primary-node', primaryNode]]),
        },
      },
      ...overrides,
    } as unknown as LavalinkMusicEngine;
  }

  it('has valid slash command metadata with name musicdiag', () => {
    expect(musicDiagCommandData.name).toBe('musicdiag');
    expect(musicDiagCommandData.description).toContain('diagnostics');
  });

  it('rejects with ephemeral message when not used in a guild', async () => {
    const playerManager = createMockPlayerManager();
    const engine = createMockEngine();
    const cmd = makeMusicDiagCommand(playerManager, engine);

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

  it('reports not connected when bot is not in a voice channel', async () => {
    const playerManager = createMockPlayerManager();
    const engine = createMockEngine({
      manager: {
        getPlayer: vi.fn(() => undefined),
        nodeManager: {
          nodes: new Map([
            ['primary-node', { connected: true, options: { host: 'localhost', port: 2333 }, stats: { players: 0 } }],
          ]),
        },
      },
    });

    const cmd = makeMusicDiagCommand(playerManager, engine);
    const deferReply = vi.fn().mockResolvedValue(undefined);
    const editReply = vi.fn().mockResolvedValue(undefined);
    const interaction = createMockInteraction({ deferReply, editReply });

    await cmd.execute(interaction);
    expect(deferReply).toHaveBeenCalled();
    expect(editReply).toHaveBeenCalled();

    const callArg = editReply.mock.calls[0]?.[0] as { embeds?: EmbedBuilder[] };
    const embed = callArg.embeds?.[0]?.data;
    expect(embed).toBeDefined();

    const fields = embed?.fields ?? [];
    const voiceChannelField = fields.find((f) => f.name.includes('Voice Channel'));
    expect(voiceChannelField?.value).toBe('❌ Not connected');

    const permField = fields.find((f) => f.name.includes('Voice Permissions'));
    expect(permField?.value).toContain('Connect to a voice channel to inspect permissions');
  });

  it('detects missing voice permissions when bot is in channel with missing ViewChannel/Connect/Speak', async () => {
    const playerManager = createMockPlayerManager();
    const engine = createMockEngine();
    const cmd = makeMusicDiagCommand(playerManager, engine);

    const hasMock = vi.fn((bit: bigint) => {
      if (bit === PermissionFlagsBits.Connect) return false;
      if (bit === PermissionFlagsBits.Speak) return false;
      return true;
    });

    const interaction = createMockInteraction({
      guild: {
        id: 'guild-1',
        members: {
          me: {
            voice: { channel: { name: 'Music Lounge', id: 'vc-123' } },
            permissionsFor: () => ({ has: hasMock }),
          },
        },
      },
    });

    await cmd.execute(interaction);
    const callArg = (interaction.editReply as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as { embeds?: EmbedBuilder[] };
    const fields = callArg.embeds?.[0]?.data?.fields ?? [];

    const permField = fields.find((f) => f.name.includes('Voice Permissions'));
    expect(permField?.value).toContain('Missing:');
    expect(permField?.value).toContain('Connect');
    expect(permField?.value).toContain('Speak');

    const summaryField = fields.find((f) => f.name.includes('Diagnostic Summary'));
    expect(summaryField?.value).toContain('Missing Permissions');
  });

  it('reports offline status when audio node is disconnected', async () => {
    const playerManager = createMockPlayerManager();
    const engine = createMockEngine({
      manager: {
        getPlayer: vi.fn(() => undefined),
        nodeManager: {
          nodes: new Map([
            ['primary-node', { connected: false, options: { host: '127.0.0.1', port: 2333 } }],
          ]),
        },
      },
    });

    const cmd = makeMusicDiagCommand(playerManager, engine);
    const interaction = createMockInteraction();

    await cmd.execute(interaction);
    const callArg = (interaction.editReply as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as { embeds?: EmbedBuilder[] };
    const fields = callArg.embeds?.[0]?.data?.fields ?? [];

    const nodeField = fields.find((f) => f.name.includes('Lavalink Node'));
    expect(nodeField?.value).toContain('Offline / Disconnected');

    const summaryField = fields.find((f) => f.name.includes('Diagnostic Summary'));
    expect(summaryField?.value).toContain('Audio Node Offline');
  });

  it('reports desynced voice gateway when bot is in channel but player is not connected', async () => {
    const playerManager = createMockPlayerManager();
    const engine = createMockEngine({
      manager: {
        getPlayer: vi.fn(() => ({
          guildId: 'guild-1',
          connected: false,
        })),
        nodeManager: {
          nodes: new Map([
            ['primary-node', { connected: true, options: { host: 'localhost', port: 2333 } }],
          ]),
        },
      },
    });

    const cmd = makeMusicDiagCommand(playerManager, engine);
    const interaction = createMockInteraction({
      guild: {
        id: 'guild-1',
        members: {
          me: {
            voice: { channel: { name: 'General', id: 'vc-1' } },
            permissionsFor: () => ({ has: () => true }),
          },
        },
      },
    });

    await cmd.execute(interaction);
    const callArg = (interaction.editReply as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as { embeds?: EmbedBuilder[] };
    const fields = callArg.embeds?.[0]?.data?.fields ?? [];

    const connField = fields.find((f) => f.name.includes('Connection State'));
    expect(connField?.value).toContain('Bot in voice channel but Lavalink player is not connected');

    const summaryField = fields.find((f) => f.name.includes('Diagnostic Summary'));
    expect(summaryField?.value).toContain('Voice Gateway Desynced');
  });

  it('accurately reports active track, progress, queue length, paused state, and backend status', async () => {
    const playerManager = createMockPlayerManager({
      getState: vi.fn(() => ({
        engineState: 'playing',
        current: sampleTrack,
        upcoming: [sampleTrack, sampleTrack],
        loopMode: 'off',
        volume: 100,
        position: 45000,
      })),
    });

    const engine = createMockEngine({
      getState: vi.fn(() => 'playing'),
      getPosition: vi.fn(() => 45000),
      isBuffering: vi.fn(() => false),
      manager: {
        getPlayer: vi.fn(() => ({
          guildId: 'guild-1',
          connected: true,
          voiceChannelId: 'vc-1',
          track: { encoded: 'enc', info: { title: 'Training Season' } },
        })),
        nodeManager: {
          nodes: new Map([
            ['primary-node', { connected: true, options: { host: 'localhost', port: 2333 }, stats: { players: 1 } }],
          ]),
        },
      },
    });

    const cmd = makeMusicDiagCommand(playerManager, engine);
    const interaction = createMockInteraction({
      guild: {
        id: 'guild-1',
        members: {
          me: {
            voice: { channel: { name: 'Music', id: 'vc-1' } },
            permissionsFor: () => ({ has: () => true }),
          },
        },
      },
    });

    await cmd.execute(interaction);
    const callArg = (interaction.editReply as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as { embeds?: EmbedBuilder[] };
    const fields = callArg.embeds?.[0]?.data?.fields ?? [];

    const trackField = fields.find((f) => f.name.includes('Current Track'));
    expect(trackField?.value).toContain('Training Season');
    expect(trackField?.value).toContain('Dua Lipa');

    const progressField = fields.find((f) => f.name.includes('Position / Duration'));
    expect(progressField?.value).toContain('00:45 / 03:29');

    const queueField = fields.find((f) => f.name.includes('Queue Length'));
    expect(queueField?.value).toBe('2 track(s)');

    const pausedField = fields.find((f) => f.name.includes('Playback Paused'));
    expect(pausedField?.value).toBe('▶️ No');

    const backendField = fields.find((f) => f.name.includes('Backend Track Loaded'));
    expect(backendField?.value).toContain('Training Season');
  });

  it('reports paused state when engineState is paused', async () => {
    const playerManager = createMockPlayerManager({
      getState: vi.fn(() => ({
        engineState: 'paused',
        current: sampleTrack,
        upcoming: [],
        loopMode: 'off',
        volume: 100,
        position: 10000,
      })),
    });

    const engine = createMockEngine({
      getState: vi.fn(() => 'paused'),
    });

    const cmd = makeMusicDiagCommand(playerManager, engine);
    const interaction = createMockInteraction();

    await cmd.execute(interaction);
    const callArg = (interaction.editReply as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as { embeds?: EmbedBuilder[] };
    const fields = callArg.embeds?.[0]?.data?.fields ?? [];

    const pausedField = fields.find((f) => f.name.includes('Playback Paused'));
    expect(pausedField?.value).toBe('⏸️ Yes');
  });

  it('reports buffering loading status when isBuffering returns true', async () => {
    const playerManager = createMockPlayerManager();
    const engine = createMockEngine({
      getState: vi.fn(() => 'buffering'),
      isBuffering: vi.fn(() => true),
    });

    const cmd = makeMusicDiagCommand(playerManager, engine);
    const interaction = createMockInteraction();

    await cmd.execute(interaction);
    const callArg = (interaction.editReply as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as { embeds?: EmbedBuilder[] };
    const fields = callArg.embeds?.[0]?.data?.fields ?? [];

    const loadingField = fields.find((f) => f.name.includes('Loading Status'));
    expect(loadingField?.value).toContain('Buffering / Loading stream');
  });

  it('surfaces last recorded playback error with actionable YouTube advice', async () => {
    const playerManager = createMockPlayerManager({
      getLastError: vi.fn(() => ({
        timestamp: Date.now() - 30000,
        trackTitle: 'Training Season',
        error: 'dev.lavalink.youtube.AllClientsFailedException: All clients failed to load the item. Client [ANDROID_VR] failed: This video requires login.',
      })),
    });

    const engine = createMockEngine();
    const cmd = makeMusicDiagCommand(playerManager, engine);
    const interaction = createMockInteraction();

    await cmd.execute(interaction);
    const callArg = (interaction.editReply as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as { embeds?: EmbedBuilder[] };
    const fields = callArg.embeds?.[0]?.data?.fields ?? [];

    const errorField = fields.find((f) => f.name.includes('Last Playback Error'));
    expect(errorField?.value).toContain('Training Season');
    expect(errorField?.value).toContain('AllClientsFailedException');

    const summaryField = fields.find((f) => f.name.includes('Diagnostic Summary'));
    expect(summaryField?.value).toContain('YouTube Stream Blocked');
  });

  it('never exposes sensitive authorization passwords or tokens in fields or description', async () => {
    const playerManager = createMockPlayerManager({
      getLastError: vi.fn(() => ({
        timestamp: Date.now(),
        trackTitle: 'Private Track',
        error: 'Authentication failed for password youshallnotpass with token secret-voice-token-xyz',
      })),
    });

    const engine = createMockEngine();
    const cmd = makeMusicDiagCommand(playerManager, engine);
    const interaction = createMockInteraction();

    await cmd.execute(interaction);
    const callArg = (interaction.editReply as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as { embeds?: EmbedBuilder[] };
    const embedStr = JSON.stringify(callArg.embeds?.[0]?.data ?? {});

    expect(embedStr).not.toContain('youshallnotpass');
    expect(embedStr).not.toContain('secret-voice-token-xyz');
    expect(embedStr).not.toContain('test-token');
  });
});
