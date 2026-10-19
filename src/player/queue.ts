/**
 * Per-guild track queue.
 *
 * Bounded, ordered, idempotent-advancement queue.
 * No playback logic here — that lives in GuildPlayerManager.
 */

import type { Track } from '../audio/types.js';
import { RifflyError } from '../errors.js';

export const DEFAULT_QUEUE_LIMIT = 100;

export type LoopMode = 'off' | 'track' | 'queue';

export class GuildQueue {
  private readonly _tracks: Track[] = [];
  private _current: Track | undefined;
  private _loopMode: LoopMode = 'off';
  readonly limit: number;

  constructor(limit = DEFAULT_QUEUE_LIMIT) {
    this.limit = limit;
  }

  get current(): Track | undefined {
    return this._current;
  }

  get upcoming(): readonly Track[] {
    return this._tracks;
  }

  get loopMode(): LoopMode {
    return this._loopMode;
  }

  get size(): number {
    return this._tracks.length;
  }

  get isEmpty(): boolean {
    return this._tracks.length === 0;
  }

  setLoopMode(mode: LoopMode): void {
    this._loopMode = mode;
  }

  /**
   * Add one or more tracks. Throws QueueLimitExceeded if adding would exceed
   * the cap.
   */
  enqueue(tracks: readonly Track[]): void {
    if (this._tracks.length + tracks.length > this.limit) {
      throw RifflyError.queueLimitExceeded(this.limit);
    }
    this._tracks.push(...tracks);
  }

  /**
   * Advance to the next track. Returns the next track or undefined if the
   * queue is exhausted. Applies loop mode.
   *
   * Call this when a trackEnd event arrives. The caller is responsible for
   * deduplicating rapid events.
   */
  advance(reason: string): Track | undefined {
    const finished = this._current;

    if (this._loopMode === 'track' && finished && reason !== 'stopped') {
      // Re-play the same track
      return finished;
    }

    if (this._loopMode === 'queue' && finished && reason !== 'stopped') {
      // Push the finished track to the back
      this._tracks.push(finished);
    }

    this._current = this._tracks.shift();
    return this._current;
  }

  /** Skip the current track and return the next one (ignores loop mode). */
  skip(): Track | undefined {
    this._current = this._tracks.shift();
    return this._current;
  }

  /** Clear the queue and current track. */
  clear(): void {
    this._tracks.length = 0;
    this._current = undefined;
  }

  /** Set current (called when playback begins). */
  setCurrent(track: Track): void {
    this._current = track;
  }

  /** Remove the current track without advancing (e.g. on stop). */
  clearCurrent(): void {
    this._current = undefined;
  }

  /** Formatted position display. */
  positionOf(track: Track): number {
    return this._tracks.indexOf(track);
  }
}
