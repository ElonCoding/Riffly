import { describe, expect, it, vi } from 'vitest';
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
    await new Promise((r) => setTimeout(r, 0));
    expect(manager.getState('g1').current?.identifier).toBe('b');
  });
});
