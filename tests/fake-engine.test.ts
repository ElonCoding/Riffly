import { describe, expect, it, vi } from 'vitest';
import { FakeMusicEngine } from '../src/audio/fake-engine.js';
import type { Track } from '../src/audio/types.js';

describe('FakeMusicEngine', () => {
  const sampleTrack: Track = {
    encoded: 'test-encoded',
    title: 'Sample Track',
    author: 'Test Artist',
    lengthMs: 180000,
    identifier: 'sample-123',
    isSeekable: true,
    isStream: false,
    uri: 'https://example.com/sample.mp3',
  };

  it('initializes with disconnected state', () => {
    const engine = new FakeMusicEngine();
    expect(engine.getState('guild-1')).toBe('disconnected');
  });

  it('transitions to idle when connected to a voice channel', async () => {
    const engine = new FakeMusicEngine();
    await engine.connect('guild-1', 'channel-1');
    expect(engine.getState('guild-1')).toBe('idle');
  });

  it('rejects connection with empty channel ID', async () => {
    const engine = new FakeMusicEngine();
    await expect(engine.connect('guild-1', '   ')).rejects.toThrow('Invalid voice channel ID');
  });

  it('handles play, pause, resume, and stop lifecycle', async () => {
    const engine = new FakeMusicEngine();
    const trackStartSpy = vi.fn();
    const trackEndSpy = vi.fn();

    engine.on('trackStart', trackStartSpy);
    engine.on('trackEnd', trackEndSpy);

    await engine.connect('guild-1', 'channel-1');

    // Play
    await engine.play('guild-1', sampleTrack);
    expect(engine.getState('guild-1')).toBe('playing');
    expect(engine.getCurrentTrack('guild-1')).toEqual(sampleTrack);
    expect(trackStartSpy).toHaveBeenCalledWith('guild-1', sampleTrack);

    // Pause
    await engine.pause('guild-1');
    expect(engine.getState('guild-1')).toBe('paused');

    // Resume
    await engine.resume('guild-1');
    expect(engine.getState('guild-1')).toBe('playing');

    // Stop
    await engine.stop('guild-1');
    expect(engine.getState('guild-1')).toBe('idle');
    expect(engine.getCurrentTrack('guild-1')).toBeUndefined();
    expect(trackEndSpy).toHaveBeenCalledWith('guild-1', sampleTrack, 'stopped');
  });

  it('fails safely when attempting to play without voice connection', async () => {
    const engine = new FakeMusicEngine();
    await expect(engine.play('guild-1', sampleTrack)).rejects.toThrow(/is not connected/);
  });

  it('fails safely when attempting to pause while not playing', async () => {
    const engine = new FakeMusicEngine();
    await engine.connect('guild-1', 'channel-1');
    await expect(engine.pause('guild-1')).rejects.toThrow(/is not currently playing/);
  });

  it('fails safely when attempting to resume while not paused', async () => {
    const engine = new FakeMusicEngine();
    await engine.connect('guild-1', 'channel-1');
    await expect(engine.resume('guild-1')).rejects.toThrow(/is not paused/);
  });

  it('emits playerDisconnect and cleans up track on disconnect', async () => {
    const engine = new FakeMusicEngine();
    const disconnectSpy = vi.fn();
    engine.on('playerDisconnect', disconnectSpy);

    await engine.connect('guild-1', 'channel-1');
    await engine.play('guild-1', sampleTrack);

    await engine.disconnect('guild-1');
    expect(engine.getState('guild-1')).toBe('disconnected');
    expect(engine.getCurrentTrack('guild-1')).toBeUndefined();
    expect(disconnectSpy).toHaveBeenCalledWith('guild-1');
  });

  it('isolates state across different guilds', async () => {
    const engine = new FakeMusicEngine();
    await engine.connect('guild-1', 'channel-1');
    await engine.play('guild-1', sampleTrack);

    expect(engine.getState('guild-1')).toBe('playing');
    expect(engine.getState('guild-2')).toBe('disconnected');
  });
});
