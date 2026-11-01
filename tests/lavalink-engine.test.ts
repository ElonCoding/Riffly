import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client } from 'discord.js';
import type { LavalinkManager, Player } from 'lavalink-client';
import { LavalinkMusicEngine } from '../src/audio/lavalink-engine.js';
import type { Track } from '../src/audio/types.js';
import { RifflyError } from '../src/errors.js';

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
    const playMock = vi.fn().mockImplementation(function (this: { queue?: { current?: unknown } }) {
      if (this?.queue) {
        this.queue.current = sampleTrack;
      }
      return Promise.resolve();
    });
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
      queue: { current: null as unknown },
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
      off: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
        if (listeners.get(event) === cb) {
          listeners.delete(event);
        }
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
    (fakePlayer as { queue: { current: unknown } }).queue = { current: sampleTrack };
    (fakePlayer as { playing: boolean }).playing = true;
    expect(engine.getState('guild-1')).toBe('playing');

    // Paused
    (fakePlayer as { paused: boolean }).paused = true;
    expect(engine.getState('guild-1')).toBe('paused');
  });

  it('reports buffering state when a track is dispatched before trackStart fires', async () => {
    const { fakeClient, fakeManager, fakePlayer, listeners } = createMockSetup();
    const engine = new LavalinkMusicEngine({
      client: fakeClient,
      config: fakeConfig,
      manager: fakeManager,
    });

    (fakePlayer as { connected: boolean }).connected = true;
    (fakePlayer as { queue: { current: unknown } }).queue = { current: sampleTrack };

    await engine.play('guild-1', sampleTrack);
    // Dispatched to Lavalink -> buffering
    expect(engine.getState('guild-1')).toBe('buffering');

    // trackStart arrives -> transitions to playing
    listeners.get('trackStart')?.(
      { guildId: 'guild-1' },
      {
        encoded: sampleTrack.encoded,
        info: {
          title: sampleTrack.title,
          author: sampleTrack.author,
          duration: sampleTrack.lengthMs,
        },
      },
    );
    expect(engine.getState('guild-1')).toBe('playing');
  });

  it('delegates connect, play, pause, resume, and stop to player', async () => {
    const { fakeClient, fakeManager, fakePlayer, mocks, listeners } = createMockSetup();
    const engine = new LavalinkMusicEngine({
      client: fakeClient,
      config: fakeConfig,
      manager: fakeManager,
    });

    await engine.connect('guild-1', 'vc-1');
    expect(mocks.connect).toHaveBeenCalled();

    // Set playing status and active track
    (fakePlayer as { connected: boolean; playing: boolean }).connected = true;
    (fakePlayer as { connected: boolean; playing: boolean }).playing = true;

    await engine.play('guild-1', sampleTrack);
    expect(mocks.play).toHaveBeenCalledWith({
      track: { encoded: 'encoded-data' },
    });

    // Fire trackStart to clear buffering flag
    listeners.get('trackStart')?.(
      { guildId: 'guild-1' },
      {
        encoded: sampleTrack.encoded,
        info: {
          title: sampleTrack.title,
          author: sampleTrack.author,
          duration: sampleTrack.lengthMs,
        },
      },
    );
    (fakePlayer as { queue: { current: unknown } }).queue = { current: sampleTrack };

    await engine.pause('guild-1');
    expect(mocks.pause).toHaveBeenCalled();

    (fakePlayer as { paused: boolean }).paused = true;
    await engine.resume('guild-1');
    expect(mocks.resume).toHaveBeenCalled();

    await engine.stop('guild-1');
    expect(mocks.stopPlaying).toHaveBeenCalled();
  });

  it('translates manager trackStart, trackEnd, trackError, and trackStuck events', () => {
    const { fakeClient, fakeManager, listeners } = createMockSetup();
    const engine = new LavalinkMusicEngine({
      client: fakeClient,
      config: fakeConfig,
      manager: fakeManager,
    });

    const startSpy = vi.fn();
    const endSpy = vi.fn();
    const errorSpy = vi.fn();
    const stuckSpy = vi.fn();

    engine.on('trackStart', startSpy);
    engine.on('trackEnd', endSpy);
    engine.on('trackError', errorSpy);
    engine.on('trackStuck', stuckSpy);

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

    // Trigger trackStuck
    listeners.get('trackStuck')?.({ guildId: 'guild-1' }, trackData, { thresholdMs: 12000 });
    expect(stuckSpy).toHaveBeenCalledWith(
      'guild-1',
      expect.objectContaining({ title: 'Song' }),
      12000,
    );
  });

  describe('Safeguard C-01: Voice Connection Handshake Timeout', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('aborts on 10,000ms timeout by disconnecting and rejecting with informative error', async () => {
      const { fakeClient, fakeManager, fakePlayer, mocks } = createMockSetup();
      // Simulate hanging connect() that never finishes
      mocks.connect.mockImplementation(() => new Promise(() => {}));
      (fakePlayer as { connected: boolean }).connected = false;

      const engine = new LavalinkMusicEngine({
        client: fakeClient,
        config: fakeConfig,
        manager: fakeManager,
      });

      const assertion = expect(engine.join('guild-1', 'vc-1')).rejects.toThrow(
        'Voice connection timeout for guild guild-1 after 10000ms',
      );

      // Fast-forward past 10,000ms
      await vi.advanceTimersByTimeAsync(10_001);
      await assertion;
      expect(mocks.disconnect).toHaveBeenCalled();
    });

    it('resolves cleanly when player.connect() finishes before timeout', async () => {
      const { fakeClient, fakeManager, fakePlayer, mocks } = createMockSetup();
      mocks.connect.mockResolvedValue(undefined);
      (fakePlayer as { connected: boolean }).connected = false;

      const engine = new LavalinkMusicEngine({
        client: fakeClient,
        config: fakeConfig,
        manager: fakeManager,
      });

      await expect(engine.join('guild-1', 'vc-1')).resolves.toBeUndefined();
      expect(mocks.connect).toHaveBeenCalled();
    });
  });

  describe('Pause & Resume Safeguards', () => {
    it('throws NotPlaying when pausing without current track', async () => {
      const { fakeClient, fakeManager, fakePlayer } = createMockSetup();
      (fakePlayer as { connected: boolean }).connected = true;
      (fakePlayer as { queue: { current: unknown } }).queue = { current: null };

      const engine = new LavalinkMusicEngine({
        client: fakeClient,
        config: fakeConfig,
        manager: fakeManager,
      });

      await expect(engine.pause('guild-1')).rejects.toThrow(RifflyError);
      await expect(engine.pause('guild-1')).rejects.toMatchObject({ code: 'NotPlaying' });
    });

    it('throws AlreadyPaused when pausing an already paused player', async () => {
      const { fakeClient, fakeManager, fakePlayer } = createMockSetup();
      (fakePlayer as { connected: boolean }).connected = true;
      (fakePlayer as { queue: { current: unknown } }).queue = { current: sampleTrack };
      (fakePlayer as { paused: boolean }).paused = true;

      const engine = new LavalinkMusicEngine({
        client: fakeClient,
        config: fakeConfig,
        manager: fakeManager,
      });

      await expect(engine.pause('guild-1')).rejects.toThrow(RifflyError);
      await expect(engine.pause('guild-1')).rejects.toMatchObject({ code: 'AlreadyPaused' });
    });

    it('throws NotPlaying when resuming without current track', async () => {
      const { fakeClient, fakeManager, fakePlayer } = createMockSetup();
      (fakePlayer as { connected: boolean }).connected = true;
      (fakePlayer as { queue: { current: unknown } }).queue = { current: null };

      const engine = new LavalinkMusicEngine({
        client: fakeClient,
        config: fakeConfig,
        manager: fakeManager,
      });

      await expect(engine.resume('guild-1')).rejects.toThrow(RifflyError);
      await expect(engine.resume('guild-1')).rejects.toMatchObject({ code: 'NotPlaying' });
    });

    it('throws NotPaused when resuming an unpaused player', async () => {
      const { fakeClient, fakeManager, fakePlayer } = createMockSetup();
      (fakePlayer as { connected: boolean }).connected = true;
      (fakePlayer as { queue: { current: unknown } }).queue = { current: sampleTrack };
      (fakePlayer as { paused: boolean }).paused = false;

      const engine = new LavalinkMusicEngine({
        client: fakeClient,
        config: fakeConfig,
        manager: fakeManager,
      });

      await expect(engine.resume('guild-1')).rejects.toThrow(RifflyError);
      await expect(engine.resume('guild-1')).rejects.toMatchObject({ code: 'NotPaused' });
    });
  });

  describe('Connection state checks and raw gateway forwarding', () => {
    it('handles player.connected being undefined/uninitialized when voiceChannelId is set', async () => {
      const { fakeClient, fakeManager, fakePlayer, mocks } = createMockSetup();
      const engine = new LavalinkMusicEngine({
        client: fakeClient,
        config: fakeConfig,
        manager: fakeManager,
      });

      // Simulates real lavalink-client behavior right after connect():
      // voiceChannelId is set, but connected is undefined (not false)
      (fakePlayer as { connected?: boolean | undefined; voiceChannelId?: string }).connected = undefined;
      (fakePlayer as { connected?: boolean | undefined; voiceChannelId?: string }).voiceChannelId = 'vc-1';

      expect(engine.getState('guild-1')).toBe('idle');
      await expect(engine.play('guild-1', sampleTrack)).resolves.toBeUndefined();
      expect(mocks.play).toHaveBeenCalled();
    });

    it('rejects play and reports disconnected when voiceChannelId is missing or connected is false', async () => {
      const { fakeClient, fakeManager, fakePlayer } = createMockSetup();
      const engine = new LavalinkMusicEngine({
        client: fakeClient,
        config: fakeConfig,
        manager: fakeManager,
      });

      // connected === false
      (fakePlayer as { connected?: boolean; voiceChannelId?: string }).connected = false;
      (fakePlayer as { connected?: boolean; voiceChannelId?: string }).voiceChannelId = 'vc-1';
      expect(engine.getState('guild-1')).toBe('disconnected');
      await expect(engine.play('guild-1', sampleTrack)).rejects.toThrow('is not connected to a voice channel');

      // missing voiceChannelId
      (fakePlayer as { connected?: boolean; voiceChannelId?: string | null }).connected = true;
      (fakePlayer as { connected?: boolean; voiceChannelId?: string | null }).voiceChannelId = null;
      expect(engine.getState('guild-1')).toBe('disconnected');
      await expect(engine.play('guild-1', sampleTrack)).rejects.toThrow('is not connected to a voice channel');
    });

    it('catches sendRawData rejections in wireEvents without unhandled rejection', () => {
      let rawHandler: ((...args: unknown[]) => void) | undefined;
      const fakeClient = {
        on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
          if (event === 'raw') rawHandler = cb;
        }),
      } as unknown as Client;

      const fakeManager = {
        nodeManager: { on: vi.fn() },
        on: vi.fn(),
        sendRawData: vi.fn().mockRejectedValue(new Error('WebSocket closed')),
      } as unknown as LavalinkManager;

      new LavalinkMusicEngine({
        client: fakeClient,
        config: fakeConfig,
        manager: fakeManager,
      });

      expect(rawHandler).toBeDefined();
      expect(() => rawHandler?.({ t: 'VOICE_SERVER_UPDATE' })).not.toThrow();
    });
  });
});
