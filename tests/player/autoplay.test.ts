import { describe, it, expect, vi } from 'vitest';
import { AutoplayManager } from '../../src/player/autoplay.js';
import type { Track } from '../../src/audio/types.js';

describe('AutoplayManager', () => {
  const sampleTrack: Track = {
    encoded: 'enc-1',
    identifier: 'id-1',
    title: 'Song A',
    author: 'Artist A',
    lengthMs: 180000,
    isSeekable: true,
    isStream: false,
    uri: 'https://example.com/a',
  };

  const nextTrack: Track = {
    encoded: 'enc-2',
    identifier: 'id-2',
    title: 'Song B',
    author: 'Artist B',
    lengthMs: 200000,
    isSeekable: true,
    isStream: false,
    uri: 'https://example.com/b',
  };

  it('manages enabled state per guild correctly', () => {
    const manager = new AutoplayManager();
    expect(manager.isEnabled('g1')).toBe(false);

    manager.setEnabled('g1', true);
    expect(manager.isEnabled('g1')).toBe(true);

    const toggled = manager.toggle('g1');
    expect(toggled).toBe(false);
    expect(manager.isEnabled('g1')).toBe(false);
  });

  it('resolves recommendation through injected resolver', async () => {
    const resolver = vi.fn().mockResolvedValue(nextTrack);
    const manager = new AutoplayManager(resolver);

    const result = await manager.getRecommendation(sampleTrack);
    expect(result).toEqual(nextTrack);
    expect(resolver).toHaveBeenCalledWith(sampleTrack);
  });

  it('returns null safely when no resolver provided', async () => {
    const manager = new AutoplayManager();
    const result = await manager.getRecommendation(sampleTrack);
    expect(result).toBeNull();
  });

  it('swallows resolver errors gracefully and returns null', async () => {
    const resolver = vi.fn().mockRejectedValue(new Error('API failure'));
    const manager = new AutoplayManager(resolver);

    const result = await manager.getRecommendation(sampleTrack);
    expect(result).toBeNull();
  });
});
