import { describe, expect, it, vi } from 'vitest';
import type { Client } from 'discord.js';
import type { LavalinkManager } from 'lavalink-client';
import { FakeMusicEngine } from '../../src/audio/fake-engine.js';
import { LavalinkMusicEngine } from '../../src/audio/lavalink-engine.js';
import type { Track } from '../../src/audio/types.js';

describe('Audio Engine Capabilities', () => {
  const sampleTrack: Track = {
    encoded: 'fake-encoded',
    title: 'Test Song',
    author: 'Test Artist',
    lengthMs: 240000,
    identifier: 'id-test',
    isSeekable: true,
    isStream: false,
    uri: 'https://example.com/audio.mp3',
  };

  describe('FakeMusicEngine Capabilities', () => {
    it('sets and retrieves playback position', async () => {
      const engine = new FakeMusicEngine();
      await engine.connect('g1', 'vc1');
      await engine.play('g1', sampleTrack);

      expect(engine.getPosition('g1')).toBe(0);
      await engine.seek('g1', 30000);
      expect(engine.getPosition('g1')).toBe(30000);

      engine.setPlaybackPosition('g1', 50000);
      expect(engine.getPosition('g1')).toBe(50000);
    });

    it('sets and retrieves volume', async () => {
      const engine = new FakeMusicEngine();
      await engine.connect('g1', 'vc1');

      expect(engine.getVolume('g1')).toBe(100);
      await engine.setVolume('g1', 75);
      expect(engine.getVolume('g1')).toBe(75);
    });

    it('rejects invalid seek or volume on fake engine', async () => {
      const engine = new FakeMusicEngine();
      await engine.connect('g1', 'vc1');

      // Seek without track
      await expect(engine.seek('g1', 1000)).rejects.toThrow(/no active track/);

      // Play then seek beyond length
      await engine.play('g1', sampleTrack);
      await expect(engine.seek('g1', 300000)).rejects.toThrow(/Invalid seek position/);

      // Volume out of bounds
      await expect(engine.setVolume('g1', -5)).rejects.toThrow(/between 0 and 1000/);
      await expect(engine.setVolume('g1', 1005)).rejects.toThrow(/between 0 and 1000/);
    });
  });

  describe('LavalinkMusicEngine Capabilities', () => {
    function setupLavalinkMock() {
      const seekMock = vi.fn().mockResolvedValue(undefined);
      const setVolumeMock = vi.fn().mockResolvedValue(undefined);

      const fakePlayer = {
        guildId: 'g1',
        voiceChannelId: 'vc1',
        connected: true,
        playing: true,
        paused: false,
        position: 42000,
        volume: 80,
        seek: seekMock,
        setVolume: setVolumeMock,
        queue: { current: sampleTrack },
      };

      const fakeClient = {
        on: vi.fn(),
        guilds: { cache: new Map() },
      } as unknown as Client;

      const fakeManager = {
        nodeManager: { on: vi.fn(), nodes: new Map() },
        on: vi.fn(),
        off: vi.fn(),
        getPlayer: vi.fn((guildId: string) => (guildId === 'g1' ? fakePlayer : null)),
        createPlayer: vi.fn(() => fakePlayer),
        init: vi.fn().mockResolvedValue(undefined),
        sendRawData: vi.fn(),
      } as unknown as LavalinkManager;

      const fakeConfig = {
        discordToken: 'token',
        discordClientId: '123',
        lavalink: { host: 'localhost', port: 2333, password: 'pwd', secure: false },
      };

      const engine = new LavalinkMusicEngine({
        client: fakeClient,
        config: fakeConfig,
        manager: fakeManager,
      });

      return { engine, fakePlayer, mocks: { seek: seekMock, setVolume: setVolumeMock } };
    }

    it('forwards seek() to underlying Lavalink player', async () => {
      const { engine, mocks } = setupLavalinkMock();

      await engine.seek('g1', 60000);
      expect(mocks.seek).toHaveBeenCalledWith(60000);
    });

    it('forwards setVolume() to underlying Lavalink player', async () => {
      const { engine, mocks } = setupLavalinkMock();

      await engine.setVolume('g1', 40);
      expect(mocks.setVolume).toHaveBeenCalledWith(40);
    });

    it('returns position from underlying Lavalink player', () => {
      const { engine, fakePlayer } = setupLavalinkMock();

      expect(engine.getPosition('g1')).toBe(42000);
      fakePlayer.position = 85000;
      expect(engine.getPosition('g1')).toBe(85000);
      expect(engine.getPosition('unknown-guild')).toBe(0);
    });

    it('throws error when seeking or setting volume for non-existent player', async () => {
      const { engine } = setupLavalinkMock();

      await expect(engine.seek('non-existent', 1000)).rejects.toThrow(/player not found/);
      await expect(engine.setVolume('non-existent', 50)).rejects.toThrow(/player not found/);
    });
  });
});
