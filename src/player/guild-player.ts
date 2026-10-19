/**
 * GuildPlayerManager.
 *
 * One manager instance per bot process. Maintains one GuildPlayer (queue +
 * engine connection) per guild. Orchestrates voice connection, track loading,
 * and queue advancement in response to MusicEngine events.
 */

import { GuildQueue } from './queue.js';
import type { LoopMode } from './queue.js';
import type { MusicEngine, PlayerState, Track } from '../audio/types.js';
import { RifflyError } from '../errors.js';

export interface GuildPlayerState {
  readonly engineState: PlayerState;
  readonly current: Track | undefined;
  readonly upcoming: readonly Track[];
  readonly loopMode: LoopMode;
}

export class GuildPlayerManager {
  private readonly queues = new Map<string, GuildQueue>();
  private readonly engine: MusicEngine;
  /** Track IDs currently being advanced (deduplication guard). */
  private readonly advancing = new Set<string>();

  constructor(engine: MusicEngine) {
    this.engine = engine;

    engine.on('trackStart', (guildId, track) => {
      const queue = this.getOrCreate(guildId);
      queue.setCurrent(track);
    });

    engine.on('trackEnd', (guildId, track, reason) => {
      // Deduplicate rapid trackEnd events for the same track
      const dedupeKey = `${guildId}:${track.encoded}:${reason}`;
      if (this.advancing.has(dedupeKey)) return;
      this.advancing.add(dedupeKey);

      void this.advanceQueue(guildId, reason).finally(() => {
        this.advancing.delete(dedupeKey);
      });
    });

    engine.on('playerDisconnect', (guildId) => {
      const queue = this.queues.get(guildId);
      if (queue) {
        queue.clear();
      }
    });
  }

  private getOrCreate(guildId: string): GuildQueue {
    let queue = this.queues.get(guildId);
    if (!queue) {
      queue = new GuildQueue();
      this.queues.set(guildId, queue);
    }
    return queue;
  }

  private async advanceQueue(guildId: string, reason: string): Promise<void> {
    const queue = this.queues.get(guildId);
    if (!queue) return;

    const next = queue.advance(reason);
    if (next) {
      try {
        await this.engine.play(guildId, next);
      } catch (err) {
        console.error(
          `[GuildPlayer:${guildId}] Failed to play next track "${next.title}":`,
          err instanceof Error ? err.message : err,
        );
      }
    }
  }

  getState(guildId: string): GuildPlayerState {
    const queue = this.queues.get(guildId);
    return {
      engineState: this.engine.getState(guildId),
      current: queue?.current,
      upcoming: queue?.upcoming ?? [],
      loopMode: queue?.loopMode ?? 'off',
    };
  }

  /** Connect to a voice channel. */
  async join(guildId: string, voiceChannelId: string): Promise<void> {
    await this.engine.connect(guildId, voiceChannelId);
    this.getOrCreate(guildId);
  }

  /** Enqueue tracks and start playback if idle. */
  async play(guildId: string, tracks: readonly Track[]): Promise<{ started: boolean }> {
    const queue = this.getOrCreate(guildId);
    const engineState = this.engine.getState(guildId);

    if (engineState === 'disconnected') {
      throw RifflyError.notInVoiceChannel();
    }

    queue.enqueue(tracks);

    if (engineState === 'idle') {
      const first = queue.advance('enqueue');
      if (first) {
        await this.engine.play(guildId, first);
        return { started: true };
      }
    }

    return { started: false };
  }

  async pause(guildId: string): Promise<void> {
    const state = this.engine.getState(guildId);
    if (state === 'paused') throw RifflyError.alreadyPaused();
    if (state !== 'playing') throw RifflyError.notPlaying();
    await this.engine.pause(guildId);
  }

  async resume(guildId: string): Promise<void> {
    const state = this.engine.getState(guildId);
    if (state !== 'paused') throw RifflyError.notPaused();
    await this.engine.resume(guildId);
  }

  async skip(guildId: string): Promise<Track | undefined> {
    const queue = this.queues.get(guildId);
    if (!queue) throw RifflyError.notPlaying();

    const state = this.engine.getState(guildId);
    if (state !== 'playing' && state !== 'paused') throw RifflyError.notPlaying();

    // Grab next track BEFORE stopping (stop emits trackEnd which may race with advanceQueue)
    const next = queue.skip();

    // Stop current; the trackEnd event from FakeEngine is synchronous so we mark
    // the dedupe key ahead of time by clearing current first.
    queue.clearCurrent();
    await this.engine.stop(guildId);

    if (next) {
      await this.engine.play(guildId, next);
    }
    return next;
  }

  async stop(guildId: string): Promise<void> {
    const queue = this.queues.get(guildId);
    if (queue) {
      queue.clear();
    }
    const state = this.engine.getState(guildId);
    if (state === 'playing' || state === 'paused') {
      await this.engine.stop(guildId);
    }
  }

  async leave(guildId: string): Promise<void> {
    const queue = this.queues.get(guildId);
    if (queue) {
      queue.clear();
    }
    await this.engine.disconnect(guildId);
    this.queues.delete(guildId);
  }

  setLoopMode(guildId: string, mode: LoopMode): void {
    this.getOrCreate(guildId).setLoopMode(mode);
  }
}
