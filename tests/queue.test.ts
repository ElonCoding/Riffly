import { describe, expect, it } from 'vitest';
import { GuildQueue } from '../src/player/queue.js';
import type { Track } from '../src/audio/types.js';

function makeTrack(id: string, lengthMs = 180000): Track {
  return {
    encoded: `encoded-${id}`,
    title: `Track ${id}`,
    author: `Artist ${id}`,
    lengthMs,
    identifier: id,
    isSeekable: true,
    isStream: false,
  };
}

describe('GuildQueue', () => {
  it('starts empty', () => {
    const q = new GuildQueue();
    expect(q.isEmpty).toBe(true);
    expect(q.size).toBe(0);
    expect(q.current).toBeUndefined();
  });

  it('enqueues tracks', () => {
    const q = new GuildQueue();
    q.enqueue([makeTrack('a'), makeTrack('b')]);
    expect(q.size).toBe(2);
  });

  it('advance returns next track and sets current', () => {
    const q = new GuildQueue();
    q.enqueue([makeTrack('a'), makeTrack('b')]);
    const next = q.advance('finished');
    expect(next?.identifier).toBe('a');
    expect(q.size).toBe(1);
  });

  it('advance returns undefined when queue empty', () => {
    const q = new GuildQueue();
    expect(q.advance('finished')).toBeUndefined();
  });

  it('loop track replays current track', () => {
    const q = new GuildQueue();
    const track = makeTrack('a');
    q.setCurrent(track);
    q.setLoopMode('track');
    const next = q.advance('finished');
    expect(next?.identifier).toBe('a');
  });

  it('loop queue requeues finished track', () => {
    const q = new GuildQueue();
    const a = makeTrack('a');
    const b = makeTrack('b');
    q.setCurrent(a);
    q.enqueue([b]);
    q.setLoopMode('queue');
    const next = q.advance('finished');
    expect(next?.identifier).toBe('b');
    expect(q.size).toBe(1); // a pushed to back
  });

  it('skip ignores loop mode', () => {
    const q = new GuildQueue();
    q.setCurrent(makeTrack('a'));
    q.enqueue([makeTrack('b')]);
    q.setLoopMode('track');
    const next = q.skip();
    expect(next?.identifier).toBe('b');
  });

  it('throws QueueLimitExceeded when limit reached', () => {
    const q = new GuildQueue(2);
    q.enqueue([makeTrack('a'), makeTrack('b')]);
    expect(() => q.enqueue([makeTrack('c')])).toThrow('Queue limit');
  });

  it('clear removes all tracks and current', () => {
    const q = new GuildQueue();
    q.setCurrent(makeTrack('a'));
    q.enqueue([makeTrack('b')]);
    q.clear();
    expect(q.isEmpty).toBe(true);
    expect(q.current).toBeUndefined();
  });
});
