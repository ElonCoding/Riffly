import { describe, expect, it, vi } from 'vitest';
import type { Client } from 'discord.js';
import type { LavalinkManager, Player } from 'lavalink-client';
import { LavalinkMusicEngine } from '../src/audio/lavalink-engine.js';
import type { Track } from '../src/audio/types.js';

describe('LavalinkMusicEngine', () => {
  const fakeConfig = {
    discordToken: 'test-token',
    discordClientId: '123456789012345678',
    lavalink: {
      host: 'localhost',
      port: 2333,
      password: 'youshallnotpass',
      secure: false,
    },
  };

  const sampleTrack: Track = {
    encoded: 'encoded-data',
    title: 'Test Song',
    author: 'Test Band',
    lengthMs: 200000,
    identifier: 'id-123',
    isSeekable: true,
    isStream: false,
    uri: 'https://example.com/test.mp3',
  };

  function createMockSetup() {
    const fakeClient = {
      on: vi.fn(),
      guilds: {
        cache: new Map(),
      },
    } as unknown as Client;

    const listeners = new Map<string, (...args: unknown[]) => void>();
    const nodeListeners = new Map<string, (...args: unknown[]) => void>();

    const connectMock = vi.fn().mockImplementation(function (this: { connected: boolean }) {
      this.connected = true;
      return Promise.resolve();
    });
    const disconnectMock = vi.fn().mockImplementation(function (this: { connected: boolean }) {
      this.connected = false;
      return Promise.resolve();
    });
    const playMock = vi.fn().mockResolvedValue(undefined);
    const pauseMock = vi.fn().mockResolvedValue(undefined);
    const resumeMock = vi.fn().mockResolvedValue(undefined);
    const stopPlayingMock = vi.fn().mockResolvedValue(undefined);
    const seekMock = vi.fn().mockResolvedValue(undefined);
    const setVolumeMock = vi.fn().mockResolvedValue(undefined);

    const fakePlayer = {
      guildId: 'guild-1',
      voiceChannelId: 'vc-1',
      connected: false,
      playing: false,
      paused: false,
      connect: connectMock,
      disconnect: disconnectMock,
      play: playMock,
      pause: pauseMock,
      resume: resumeMock,
      stopPlaying: stopPlayingMock,
      seek: seekMock,
      setVolume: setVolumeMock,
    };

    const fakeManager = {
      nodeManager: {
        on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
          nodeListeners.set(event, cb);
        }),
      },
      on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
        listeners.set(event, cb);
      }),
      getPlayer: vi.fn(() => fakePlayer),
      createPlayer: vi.fn(() => fakePlayer),
      init: vi.fn().mockResolvedValue(undefined),
      sendRawData: vi.fn(),
    } as unknown as LavalinkManager;

    return {
      fakeClient,
      fakeManager,
      fakePlayer: fakePlayer as unknown as Player,
      mocks: {
        connect: connectMock,
        disconnect: disconnectMock,
        play: playMock,
        pause: pauseMock,
        resume: resumeMock,
        stopPlaying: stopPlayingMock,
        seek: seekMock,
        setVolume: setVolumeMock,
      },
      listeners,
      nodeListeners,
    };
  }

  it('reports correct player states based on connection and playback status', () => {
    const { fakeClient, fakeManager, fakePlayer } = createMockSetup();
    const engine = new LavalinkMusicEngine({
      client: fakeClient,
      config: fakeConfig,
      manager: fakeManager,
    });

    // Disconnected
    expect(engine.getState('guild-1')).toBe('disconnected');

    // Idle
    (fakePlayer as { connected: boolean }).connected = true;
    expect(engine.getState('guild-1')).toBe('idle');

    // Playing
    (fakePlayer as { playing: boolean }).playing = true;
    expect(engine.getState('guild-1')).toBe('playing');

    // Paused
    (fakePlayer as { paused: boolean }).paused = true;
    expect(engine.getState('guild-1')).toBe('paused');
  });

  it('delegates connect, play, pause, resume, and stop to player', async () => {
    const { fakeClient, fakeManager, fakePlayer, mocks } = createMockSetup();
    const engine = new LavalinkMusicEngine({
      client: fakeClient,
      config: fakeConfig,
      manager: fakeManager,
    });

    await engine.connect('guild-1', 'vc-1');
    expect(mocks.connect).toHaveBeenCalled();

    // Set playing status
    (fakePlayer as { connected: boolean; playing: boolean }).connected = true;
    (fakePlayer as { connected: boolean; playing: boolean }).playing = true;

    await engine.play('guild-1', sampleTrack);
    expect(mocks.play).toHaveBeenCalledWith({
      track: { encoded: 'encoded-data' },
    });

    await engine.pause('guild-1');
    expect(mocks.pause).toHaveBeenCalled();

    (fakePlayer as { paused: boolean }).paused = true;
    await engine.resume('guild-1');
    expect(mocks.resume).toHaveBeenCalled();

    await engine.stop('guild-1');
    expect(mocks.stopPlaying).toHaveBeenCalled();
  });

  it('translates manager trackStart, trackEnd, and trackError events', () => {
    const { fakeClient, fakeManager, listeners } = createMockSetup();
    const engine = new LavalinkMusicEngine({
      client: fakeClient,
      config: fakeConfig,
      manager: fakeManager,
    });

    const startSpy = vi.fn();
    const endSpy = vi.fn();
    const errorSpy = vi.fn();

    engine.on('trackStart', startSpy);
    engine.on('trackEnd', endSpy);
    engine.on('trackError', errorSpy);

    const trackData = {
      encoded: 'sample-encoded',
      info: {
        title: 'Song',
        author: 'Artist',
        duration: 120000,
        identifier: 'id',
        isSeekable: true,
        isStream: false,
      },
    };

    // Trigger trackStart
    listeners.get('trackStart')?.({ guildId: 'guild-1' }, trackData);
    expect(startSpy).toHaveBeenCalledWith(
      'guild-1',
      expect.objectContaining({ title: 'Song', author: 'Artist' }),
    );

    // Trigger trackEnd
    listeners.get('trackEnd')?.({ guildId: 'guild-1' }, trackData, { reason: 'finished' });
    expect(endSpy).toHaveBeenCalledWith(
      'guild-1',
      expect.objectContaining({ title: 'Song' }),
      'finished',
    );

    // Trigger trackError
    listeners.get('trackError')?.({ guildId: 'guild-1' }, trackData, {
      exception: { message: 'Decoder failure' },
    });
    expect(errorSpy).toHaveBeenCalledWith(
      'guild-1',
      expect.objectContaining({ title: 'Song' }),
      expect.any(Error),
    );
  });
});
