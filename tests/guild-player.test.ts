import { describe, expect, it, vi } from 'vitest';
import type { Client } from 'discord.js';
import { GuildPlayerManager } from '../src/player/guild-player.js';
import { FakeMusicEngine } from '../src/audio/fake-engine.js';
import type { Track } from '../src/audio/types.js';
import { RifflyError } from '../src/errors.js';

function makeTrack(id: string): Track {
  return {
    encoded: `encoded-${id}`,
    title: `Track ${id}`,
    author: `Artist ${id}`,
    lengthMs: 180000,
    identifier: id,
    isSeekable: true,
    isStream: false,
  };
}

async function setupConnected(guildId = 'g1', voiceChannelId = 'vc1') {
  const engine = new FakeMusicEngine();
  const manager = new GuildPlayerManager(engine);
  await manager.join(guildId, voiceChannelId);
  return { engine, manager };
}

describe('GuildPlayerManager', () => {
  it('join connects engine', async () => {
    const { engine } = await setupConnected();
    expect(engine.getState('g1')).toBe('idle');
  });

  it('play starts first track immediately when idle', async () => {
    const { manager } = await setupConnected();
    const { started } = await manager.play('g1', [makeTrack('a')]);
    expect(started).toBe(true);
    expect(manager.getState('g1').current?.identifier).toBe('a');
  });

  it('play enqueues when already playing', async () => {
    const { manager } = await setupConnected();
    await manager.play('g1', [makeTrack('a')]);
    const { started } = await manager.play('g1', [makeTrack('b')]);
    expect(started).toBe(false);
    expect(manager.getState('g1').upcoming).toHaveLength(1);
  });

  it('pause/resume round-trip', async () => {
    const { manager } = await setupConnected();
    await manager.play('g1', [makeTrack('a')]);
    await manager.pause('g1');
    expect(manager.getState('g1').engineState).toBe('paused');
    await manager.resume('g1');
    expect(manager.getState('g1').engineState).toBe('playing');
  });

  it('pause throws AlreadyPaused', async () => {
    const { manager } = await setupConnected();
    await manager.play('g1', [makeTrack('a')]);
    await manager.pause('g1');
    await expect(manager.pause('g1')).rejects.toBeInstanceOf(RifflyError);
  });

  it('resume throws NotPaused when playing', async () => {
    const { manager } = await setupConnected();
    await manager.play('g1', [makeTrack('a')]);
    await expect(manager.resume('g1')).rejects.toBeInstanceOf(RifflyError);
  });

  it('skip advances to next track', async () => {
    const { manager } = await setupConnected();
    await manager.play('g1', [makeTrack('a')]);
    await manager.play('g1', [makeTrack('b')]);
    const next = await manager.skip('g1');
    expect(next?.identifier).toBe('b');
  });

  it('stop clears queue and stops engine', async () => {
    const { manager } = await setupConnected();
    await manager.play('g1', [makeTrack('a')]);
    await manager.play('g1', [makeTrack('b')]);
    await manager.stop('g1');
    expect(manager.getState('g1').upcoming).toHaveLength(0);
    expect(manager.getState('g1').engineState).toBe('idle');
  });

  it('leave disconnects and deletes guild state', async () => {
    const { manager, engine } = await setupConnected();
    await manager.leave('g1');
    expect(engine.getState('g1')).toBe('disconnected');
  });

  it('play throws NotInVoiceChannel when not connected', async () => {
    const engine = new FakeMusicEngine();
    const manager = new GuildPlayerManager(engine);
    await expect(manager.play('g1', [makeTrack('a')])).rejects.toBeInstanceOf(RifflyError);
  });

  it('two guilds are isolated', async () => {
    const { manager } = await setupConnected('g1');
    await manager.join('g2', 'vc2');
    await manager.play('g1', [makeTrack('a')]);
    await manager.play('g2', [makeTrack('b')]);
    expect(manager.getState('g1').current?.identifier).toBe('a');
    expect(manager.getState('g2').current?.identifier).toBe('b');
  });

  it('trackEnd auto-advances queue', async () => {
    const engine = new FakeMusicEngine();
    const manager = new GuildPlayerManager(engine);
    await manager.join('g1', 'vc1');
    await manager.play('g1', [makeTrack('a')]);
    await manager.play('g1', [makeTrack('b')]);

    // Simulate trackEnd event for track 'a'
    const trackA = manager.getState('g1').current!;
    engine.emit('trackEnd', 'g1', trackA, 'finished');

    // Let microtask queue flush
    await new Promise((r) => setTimeout(r, 10));
    expect(manager.getState('g1').current?.identifier).toBe('b');
  });

  describe('DEF-03: Double-skip cascade prevention', () => {
    it('does not advance queue a second time when trackEnd emits stopped or replaced', async () => {
      const { manager, engine } = await setupConnected();
      await manager.play('g1', [makeTrack('a')]);
      await manager.play('g1', [makeTrack('b')]);
      await manager.play('g1', [makeTrack('c')]);

      // Skip 'a' -> should play 'b', upcoming should have 'c'
      const next = await manager.skip('g1');
      expect(next?.identifier).toBe('b');
      expect(manager.getState('g1').current?.identifier).toBe('b');
      expect(manager.getState('g1').upcoming).toHaveLength(1);
      expect(manager.getState('g1').upcoming[0]?.identifier).toBe('c');

      // Now simulate a stray 'stopped' or 'replaced' trackEnd event for 'a'
      engine.emit('trackEnd', 'g1', makeTrack('a'), 'stopped');
      await new Promise((r) => setTimeout(r, 10));

      // 'b' should STILL be playing, 'c' should STILL be in upcoming
      expect(manager.getState('g1').current?.identifier).toBe('b');
      expect(manager.getState('g1').upcoming).toHaveLength(1);
      expect(manager.getState('g1').upcoming[0]?.identifier).toBe('c');
    });
  });

  describe('DEF-04: Quick-play concurrency serialization', () => {
    it('concurrent play calls do not clobber active track', async () => {
      const { manager } = await setupConnected();

      // Fire two play calls concurrently without awaiting the first before starting the second
      const p1 = manager.play('g1', [makeTrack('song1')]);
      const p2 = manager.play('g1', [makeTrack('song2')]);

      const [res1, res2] = await Promise.all([p1, p2]);
      expect(res1.started).toBe(true);
      expect(res2.started).toBe(false);

      const state = manager.getState('g1');
      expect(state.current?.identifier).toBe('song1');
      expect(state.upcoming).toHaveLength(1);
      expect(state.upcoming[0]?.identifier).toBe('song2');
    });
  });

  describe('Safeguard C-06: Inactivity Timer (waitTimeout)', () => {
    it('arms waitTimeout when stopping playback and clears on enqueue', async () => {
      const { manager } = await setupConnected();
      await manager.play('g1', [makeTrack('a')]);

      // Stop arms the inactivity timer
      await manager.stop('g1');
      expect(manager.isWaiting('g1')).toBe(true);

      // Enqueueing a new track clears the inactivity timer
      await manager.play('g1', [makeTrack('b')]);
      expect(manager.isWaiting('g1')).toBe(false);
    });

    it('arms waitTimeout when clear() is called on idle queue', async () => {
      const { manager } = await setupConnected();
      manager.clear('g1');
      expect(manager.isWaiting('g1')).toBe(true);
    });

    it('keeps current track playing and clears upcoming when clear() is called during playback', async () => {
      const { manager } = await setupConnected();
      await manager.play('g1', [makeTrack('a')]);
      await manager.play('g1', [makeTrack('b')]);
      expect(manager.getState('g1').upcoming).toHaveLength(1);

      manager.clear('g1');
      expect(manager.getState('g1').current?.identifier).toBe('a');
      expect(manager.getState('g1').upcoming).toHaveLength(0);
      expect(manager.isWaiting('g1')).toBe(false);
    });
  });

  describe('Safeguard C-05: Consecutive Error Circuit Breaker', () => {
    it('trips circuit breaker after 3 errors within 5000ms', async () => {
      const engine = new FakeMusicEngine();
      const manager = new GuildPlayerManager(engine);
      await manager.join('g1', 'vc1');

      await manager.play('g1', [makeTrack('t1')]);
      await manager.play('g1', [makeTrack('t2')]);
      await manager.play('g1', [makeTrack('t3')]);
      await manager.play('g1', [makeTrack('t4')]);

      // Emit error 1
      engine.emit('trackError', 'g1', makeTrack('t1'), new Error('Error 1'));
      await new Promise((r) => setTimeout(r, 10));

      // Emit error 2
      engine.emit('trackError', 'g1', makeTrack('t2'), new Error('Error 2'));
      await new Promise((r) => setTimeout(r, 10));

      // Emit error 3 (stuck or error)
      engine.emit('trackStuck', 'g1', makeTrack('t3'), 10000);
      await new Promise((r) => setTimeout(r, 15));

      // Circuit breaker should have tripped:
      // queue cleared, playback stopped, waitTimeout armed
      const state = manager.getState('g1');
      expect(state.upcoming).toHaveLength(0);
      expect(manager.isWaiting('g1')).toBe(true);
    });
  });

  describe('trackError text channel notification', () => {
    it('notifies the Discord text channel when a track errors out', async () => {
      const sendMock = vi.fn().mockResolvedValue(undefined);
      const fakeClient = {
        channels: {
          cache: new Map([['tc-123', { send: sendMock }]]),
        },
      } as unknown as Client;

      const engine = new FakeMusicEngine();
      const manager = new GuildPlayerManager(engine, { client: fakeClient });
      await manager.join('g1', 'vc1', 'tc-123');

      await manager.play('g1', [makeTrack('fail1')]);

      const failingTrack = makeTrack('fail1');
      engine.emit('trackError', 'g1', failingTrack, new Error('YouTube cipher parsing failure'));

      // Let microtask flush
      await new Promise((r) => setTimeout(r, 20));

      expect(sendMock).toHaveBeenCalled();
      const callArg = sendMock.mock.calls[0]?.[0] as { content?: string } | undefined;
      expect(callArg?.content).toContain('Playback error');
      expect(callArg?.content).toContain('Track fail1');
      expect(callArg?.content).toContain('YouTube cipher parsing failure');
    });
  });
});
