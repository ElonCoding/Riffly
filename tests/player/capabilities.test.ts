import { describe, expect, it } from 'vitest';
import { GuildPlayerManager } from '../../src/player/guild-player.js';
import { FakeMusicEngine } from '../../src/audio/fake-engine.js';
import type { Track } from '../../src/audio/types.js';
import { RifflyError } from '../../src/errors.js';

function makeTrack(id: string, options?: { lengthMs?: number; isSeekable?: boolean }): Track {
  return {
    encoded: `encoded-${id}`,
    title: `Track ${id}`,
    author: `Artist ${id}`,
    lengthMs: options?.lengthMs ?? 180000,
    identifier: id,
    isSeekable: options?.isSeekable ?? true,
    isStream: false,
    uri: `https://example.com/${id}`,
  };
}

async function setupManager(guildId = 'guild-cap', voiceChannelId = 'vc-cap') {
  const engine = new FakeMusicEngine();
  const manager = new GuildPlayerManager(engine);
  await manager.join(guildId, voiceChannelId);
  return { engine, manager, guildId };
}

describe('Player Capabilities — GuildPlayerManager & GuildQueue', () => {
  describe('Seek Capability', () => {
    it('successfully seeks to valid position within track length', async () => {
      const { manager, engine, guildId } = await setupManager();
      await manager.play(guildId, [makeTrack('s1', { lengthMs: 200000 })]);

      expect(manager.getPlaybackPosition(guildId)).toBe(0);
      await manager.seek(guildId, 65000);

      expect(manager.getPlaybackPosition(guildId)).toBe(65000);
      expect(manager.getState(guildId).position).toBe(65000);
      expect(engine.getPosition(guildId)).toBe(65000);
    });

    it('rejects seek when no track is currently playing', async () => {
      const { manager, guildId } = await setupManager();

      await expect(manager.seek(guildId, 10000)).rejects.toThrow(RifflyError);
      await expect(manager.seek(guildId, 10000)).rejects.toMatchObject({ code: 'NotPlaying' });
    });

    it('rejects seek if current track is not seekable', async () => {
      const { manager, guildId } = await setupManager();
      await manager.play(guildId, [makeTrack('live-stream', { isSeekable: false, lengthMs: 0 })]);

      await expect(manager.seek(guildId, 1000)).rejects.toThrow(RifflyError);
      await expect(manager.seek(guildId, 1000)).rejects.toMatchObject({ code: 'InvalidInput' });
    });

    it('rejects seek if position is negative or exceeds track length', async () => {
      const { manager, guildId } = await setupManager();
      await manager.play(guildId, [makeTrack('s2', { lengthMs: 120000 })]);

      await expect(manager.seek(guildId, -500)).rejects.toThrow(RifflyError);
      await expect(manager.seek(guildId, -500)).rejects.toMatchObject({ code: 'InvalidInput' });

      await expect(manager.seek(guildId, 120001)).rejects.toThrow(RifflyError);
      await expect(manager.seek(guildId, 120001)).rejects.toMatchObject({ code: 'InvalidInput' });
    });

    it('rejects seek if bot is not in a voice channel', async () => {
      const engine = new FakeMusicEngine();
      const manager = new GuildPlayerManager(engine);

      await expect(manager.seek('unconnected-guild', 5000)).rejects.toThrow(RifflyError);
      await expect(manager.seek('unconnected-guild', 5000)).rejects.toMatchObject({
        code: 'NotInVoiceChannel',
      });
    });
  });

  describe('Volume Capability', () => {
    it('sets and retrieves volume between 0 and 100', async () => {
      const { manager, engine, guildId } = await setupManager();
      expect(manager.getVolume(guildId)).toBe(100);

      await manager.setVolume(guildId, 50);
      expect(manager.getVolume(guildId)).toBe(50);
      expect(manager.getState(guildId).volume).toBe(50);
      expect(engine.getVolume(guildId)).toBe(50);

      await manager.setVolume(guildId, 0);
      expect(manager.getVolume(guildId)).toBe(0);

      await manager.setVolume(guildId, 100);
      expect(manager.getVolume(guildId)).toBe(100);
    });

    it('rejects volume outside 0 to 100 boundary', async () => {
      const { manager, guildId } = await setupManager();

      await expect(manager.setVolume(guildId, -1)).rejects.toThrow(RifflyError);
      await expect(manager.setVolume(guildId, -1)).rejects.toMatchObject({ code: 'InvalidInput' });

      await expect(manager.setVolume(guildId, 101)).rejects.toThrow(RifflyError);
      await expect(manager.setVolume(guildId, 101)).rejects.toMatchObject({ code: 'InvalidInput' });

      await expect(manager.setVolume(guildId, Number.NaN)).rejects.toThrow(RifflyError);
    });

    it('rejects setVolume if bot is disconnected', async () => {
      const engine = new FakeMusicEngine();
      const manager = new GuildPlayerManager(engine);

      await expect(manager.setVolume('unconnected-guild', 80)).rejects.toThrow(RifflyError);
      await expect(manager.setVolume('unconnected-guild', 80)).rejects.toMatchObject({
        code: 'NotInVoiceChannel',
      });
    });
  });

  describe('Loop Mode Capability', () => {
    it('updates and returns loop mode', async () => {
      const { manager, guildId } = await setupManager();
      expect(manager.getLoopMode(guildId)).toBe('off');

      const modeTrack = manager.setLoopMode(guildId, 'track');
      expect(modeTrack).toBe('track');
      expect(manager.getLoopMode(guildId)).toBe('track');
      expect(manager.getState(guildId).loopMode).toBe('track');

      const modeQueue = manager.setLoopMode(guildId, 'queue');
      expect(modeQueue).toBe('queue');
      expect(manager.getLoopMode(guildId)).toBe('queue');

      const modeOff = manager.setLoopMode(guildId, 'off');
      expect(modeOff).toBe('off');
      expect(manager.getLoopMode(guildId)).toBe('off');
    });

    it('rejects invalid loop mode strings', async () => {
      const { manager, guildId } = await setupManager();

      // @ts-expect-error Testing invalid runtime string
      expect(() => manager.setLoopMode(guildId, 'invalid')).toThrow(RifflyError);
    });
  });

  describe('Shuffle Capability', () => {
    it('shuffles upcoming tracks using Fisher-Yates without affecting current track', async () => {
      const { manager, guildId } = await setupManager();
      const tracks = Array.from({ length: 15 }, (_, i) => makeTrack(`track-${i}`));
      await manager.play(guildId, tracks);

      const stateBefore = manager.getState(guildId);
      expect(stateBefore.current?.identifier).toBe('track-0');
      const upcomingIdsBefore = stateBefore.upcoming.map((t) => t.identifier);
      expect(upcomingIdsBefore).toHaveLength(14);

      manager.shuffle(guildId);

      const stateAfter = manager.getState(guildId);
      // Current track remains untouched
      expect(stateAfter.current?.identifier).toBe('track-0');
      const upcomingIdsAfter = stateAfter.upcoming.map((t) => t.identifier);
      expect(upcomingIdsAfter).toHaveLength(14);
      // All items still exist (permutation check)
      expect(new Set(upcomingIdsAfter)).toEqual(new Set(upcomingIdsBefore));
    });

    it('throws EmptyQueue when trying to shuffle an empty queue', async () => {
      const { manager, guildId } = await setupManager();

      expect(() => manager.shuffle(guildId)).toThrow(RifflyError);
      expect(() => manager.shuffle(guildId)).toThrowError(
        expect.objectContaining({ code: 'EmptyQueue' }),
      );
    });
  });

  describe('Remove Capability', () => {
    it('removes track at 1-based index and returns it', async () => {
      const { manager, guildId } = await setupManager();
      const t0 = makeTrack('curr');
      const t1 = makeTrack('up-1');
      const t2 = makeTrack('up-2');
      const t3 = makeTrack('up-3');

      await manager.play(guildId, [t0, t1, t2, t3]);
      expect(manager.getState(guildId).upcoming).toHaveLength(3);

      // Remove 2nd upcoming track ('up-2') using 1-based index 2
      const removed = manager.remove(guildId, 2);
      expect(removed.identifier).toBe('up-2');

      const upcoming = manager.getState(guildId).upcoming;
      expect(upcoming).toHaveLength(2);
      expect(upcoming[0]?.identifier).toBe('up-1');
      expect(upcoming[1]?.identifier).toBe('up-3');
    });

    it('throws InvalidInput when index is out of bounds or not an integer', async () => {
      const { manager, guildId } = await setupManager();
      await manager.play(guildId, [makeTrack('curr'), makeTrack('up-1')]);

      // 1-based bounds are 1..1
      expect(() => manager.remove(guildId, 0)).toThrow(RifflyError);
      expect(() => manager.remove(guildId, 2)).toThrow(RifflyError);
      expect(() => manager.remove(guildId, -1)).toThrow(RifflyError);
      expect(() => manager.remove(guildId, 1.5)).toThrow(RifflyError);
    });

    it('throws EmptyQueue when removing from an empty upcoming queue', async () => {
      const { manager, guildId } = await setupManager();
      await manager.play(guildId, [makeTrack('curr')]);

      expect(() => manager.remove(guildId, 1)).toThrow(RifflyError);
      expect(() => manager.remove(guildId, 1)).toThrowError(
        expect.objectContaining({ code: 'EmptyQueue' }),
      );
    });
  });

  describe('Clear Capability', () => {
    it('clears all upcoming tracks while preserving the currently playing track', async () => {
      const { manager, guildId } = await setupManager();
      await manager.play(guildId, [makeTrack('current'), makeTrack('next-1'), makeTrack('next-2')]);

      expect(manager.getState(guildId).upcoming).toHaveLength(2);
      manager.clear(guildId);

      const state = manager.getState(guildId);
      expect(state.current?.identifier).toBe('current');
      expect(state.upcoming).toHaveLength(0);
      expect(state.engineState).toBe('playing');
      expect(manager.isWaiting(guildId)).toBe(false);
    });

    it('arms inactivity disconnect timer when clearing an idle player', async () => {
      const { manager, guildId } = await setupManager();
      expect(manager.isWaiting(guildId)).toBe(false);

      manager.clear(guildId);
      expect(manager.isWaiting(guildId)).toBe(true);
    });
  });

  describe('Playback Position Tracking', () => {
    it('tracks position changes through getPlaybackPosition and getState', async () => {
      const { manager, engine, guildId } = await setupManager();
      await manager.play(guildId, [makeTrack('p1', { lengthMs: 300000 })]);

      expect(manager.getPlaybackPosition(guildId)).toBe(0);
      expect(manager.getState(guildId).position).toBe(0);

      engine.setPlaybackPosition(guildId, 45000);
      expect(manager.getPlaybackPosition(guildId)).toBe(45000);
      expect(manager.getState(guildId).position).toBe(45000);

      await manager.seek(guildId, 120000);
      expect(manager.getPlaybackPosition(guildId)).toBe(120000);
      expect(manager.getState(guildId).position).toBe(120000);
    });
  });
});
