/**
 * GuildPlayerManager.
 *
 * One manager instance per bot process. Maintains one GuildPlayer (queue +
 * engine connection) per guild. Orchestrates voice connection, track loading,
 * concurrency serialization via per-guild AsyncMutex, inactivity disconnect
 * timers, and error recovery circuit breaking.
 */

import { GuildQueue } from './queue.js';
import type { LoopMode } from './queue.js';
import { AsyncMutex } from './mutex.js';
import type { MusicEngine, PlayerState, Track } from '../audio/types.js';
import { RifflyError } from '../errors.js';

export interface GuildPlayerState {
  readonly engineState: PlayerState;
  readonly current: Track | undefined;
  readonly upcoming: readonly Track[];
  readonly loopMode: LoopMode;
}

export interface GuildPlayerManagerOptions {
  readonly waitTimeoutMs?: number;
}

export class GuildPlayerManager {
  public static readonly DEFAULT_WAIT_TIMEOUT_MS = 180_000;
  private readonly queues = new Map<string, GuildQueue>();
  private readonly mutexes = new Map<string, AsyncMutex>();
  private readonly waitTimeouts = new Map<string, NodeJS.Timeout>();
  private readonly errorHistory = new Map<string, number[]>();
  private readonly engine: MusicEngine;
  private readonly waitTimeoutMs: number;
  /** Track IDs currently being advanced (deduplication guard). */
  private readonly advancing = new Set<string>();

  constructor(engine: MusicEngine, options?: GuildPlayerManagerOptions) {
    this.engine = engine;
    this.waitTimeoutMs = options?.waitTimeoutMs ?? GuildPlayerManager.DEFAULT_WAIT_TIMEOUT_MS;

    engine.on('trackStart', (guildId, track) => {
      const queue = this.getOrCreate(guildId);
      queue.setCurrent(track);
    });

    engine.on('trackEnd', (guildId, track, reason) => {
      // Fixes DEF-03 double-skip: manual skip or stop already handles queue advance
      if (reason === 'stopped' || reason === 'replaced') {
        return;
      }

      // Deduplicate rapid trackEnd events for the same track
      const dedupeKey = `${guildId}:${track.encoded}:${reason}`;
      if (this.advancing.has(dedupeKey)) return;
      this.advancing.add(dedupeKey);

      void this.advanceQueue(guildId, reason).finally(() => {
        this.advancing.delete(dedupeKey);
      });
    });

    // Safeguard C-05: Listen for trackError and trackStuck on engine
    engine.on('trackError', (guildId, track, error) => {
      console.error(
        `[GuildPlayer:${guildId}] Track error for "${track?.title ?? 'unknown'}":`,
        error.message,
      );
      void this.handlePlaybackError(guildId);
    });

    engine.on('trackStuck', (guildId, track, thresholdMs) => {
      console.warn(
        `[GuildPlayer:${guildId}] Track stuck for "${track?.title ?? 'unknown'}" after ${thresholdMs}ms`,
      );
      void this.handlePlaybackError(guildId);
    });

    engine.on('playerDisconnect', (guildId) => {
      this.clearWaitTimeout(guildId);
      this.errorHistory.delete(guildId);
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

  private getMutex(guildId: string): AsyncMutex {
    let mutex = this.mutexes.get(guildId);
    if (!mutex) {
      mutex = new AsyncMutex();
      this.mutexes.set(guildId, mutex);
    }
    return mutex;
  }

  private armWaitTimeout(guildId: string): void {
    this.clearWaitTimeout(guildId);
    const timeout = setTimeout(() => {
      this.waitTimeouts.delete(guildId);
      void this.leave(guildId).catch((err) => {
        console.error(
          `[GuildPlayer:${guildId}] Error during inactivity disconnect:`,
          err instanceof Error ? err.message : err,
        );
      });
    }, this.waitTimeoutMs);
    timeout.unref?.();
    this.waitTimeouts.set(guildId, timeout);
  }

  private clearWaitTimeout(guildId: string): void {
    const existing = this.waitTimeouts.get(guildId);
    if (existing) {
      clearTimeout(existing);
      this.waitTimeouts.delete(guildId);
    }
  }

  /**
   * Safeguard C-05: Consecutive error circuit breaker.
   * If 3 errors occur within 5,000ms, halt playback, clear queue, log warning,
   * and arm waitTimeout. Otherwise, call advanceQueue(guildId, 'error').
   */
  private async handlePlaybackError(guildId: string): Promise<void> {
    const now = Date.now();
    const history = this.errorHistory.get(guildId) ?? [];
    const recentErrors = history.filter((timestamp) => now - timestamp <= 5000);
    recentErrors.push(now);
    this.errorHistory.set(guildId, recentErrors);

    if (recentErrors.length >= 3) {
      console.warn(
        `[GuildPlayer:${guildId}] Circuit breaker tripped: 3 playback errors within 5000ms. Halting playback.`,
      );
      this.errorHistory.delete(guildId);
      await this.getMutex(guildId).runExclusive(async () => {
        const queue = this.queues.get(guildId);
        if (queue) {
          queue.clear();
        }
        try {
          await this.engine.stop(guildId);
        } catch (err) {
          console.error(
            `[GuildPlayer:${guildId}] Error stopping engine during circuit breaker halt:`,
            err,
          );
        }
        this.armWaitTimeout(guildId);
      });
      return;
    }

    await this.advanceQueue(guildId, 'error');
  }

  private async advanceQueue(guildId: string, reason: string): Promise<void> {
    return this.getMutex(guildId).runExclusive(async () => {
      const queue = this.queues.get(guildId);
      if (!queue) {
        this.armWaitTimeout(guildId);
        return;
      }

      let currentReason = reason;
      let next = queue.advance(currentReason);
      while (next) {
        try {
          await this.engine.play(guildId, next);
          return;
        } catch (err) {
          console.error(
            `[GuildPlayer:${guildId}] Failed to play next track "${next.title}":`,
            err instanceof Error ? err.message : err,
          );
          currentReason = 'error';
          next = queue.advance(currentReason);
        }
      }

      // When queue becomes empty/idle, arm inactivity disconnect timer
      this.armWaitTimeout(guildId);
    });
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

  /** Enqueue tracks and start playback if idle (protected by per-guild mutex). */
  async play(guildId: string, tracks: readonly Track[]): Promise<{ started: boolean }> {
    return this.getMutex(guildId).runExclusive(async () => {
      const queue = this.getOrCreate(guildId);
      const engineState = this.engine.getState(guildId);

      if (engineState === 'disconnected') {
        throw RifflyError.notInVoiceChannel();
      }

      // Clear waitTimeout immediately upon new track enqueue
      this.clearWaitTimeout(guildId);
      queue.enqueue(tracks);

      if (engineState === 'idle') {
        const first = queue.advance('enqueue');
        if (first) {
          await this.engine.play(guildId, first);
          return { started: true };
        }
      }

      return { started: false };
    });
  }

  async pause(guildId: string): Promise<void> {
    const state = this.engine.getState(guildId);
    if (state === 'paused') throw RifflyError.alreadyPaused();
    if (state === 'disconnected' || state === 'idle') throw RifflyError.notPlaying();
    await this.engine.pause(guildId);
  }

  async resume(guildId: string): Promise<void> {
    const state = this.engine.getState(guildId);
    if (state !== 'paused') throw RifflyError.notPaused();
    await this.engine.resume(guildId);
  }

  async skip(guildId: string): Promise<Track | undefined> {
    return this.getMutex(guildId).runExclusive(async () => {
      const queue = this.queues.get(guildId);
      if (!queue) throw RifflyError.notPlaying();

      const state = this.engine.getState(guildId);
      if (state !== 'playing' && state !== 'paused' && state !== 'buffering') {
        throw RifflyError.notPlaying();
      }

      // Grab next track BEFORE stopping (stop emits trackEnd with reason 'stopped')
      const next = queue.skip();

      queue.clearCurrent();
      await this.engine.stop(guildId);

      if (next) {
        await this.engine.play(guildId, next);
      } else {
        this.armWaitTimeout(guildId);
      }
      return next;
    });
  }

  async stop(guildId: string): Promise<void> {
    return this.getMutex(guildId).runExclusive(async () => {
      const queue = this.queues.get(guildId);
      if (queue) {
        queue.clear();
      }
      const state = this.engine.getState(guildId);
      if (state === 'playing' || state === 'paused' || state === 'buffering') {
        await this.engine.stop(guildId);
      }
      // Safeguard C-06: Explicitly arm waitTimeout in stop()
      this.armWaitTimeout(guildId);
    });
  }

  /**
   * Safeguard C-06: Clear queue and arm waitTimeout.
   */
  async clear(guildId: string): Promise<void> {
    return this.getMutex(guildId).runExclusive(async () => {
      await Promise.resolve();
      const queue = this.queues.get(guildId);
      if (queue) {
        queue.clear();
      }
      // Safeguard C-06: Explicitly arm waitTimeout in clear()
      this.armWaitTimeout(guildId);
    });
  }

  async leave(guildId: string): Promise<void> {
    this.clearWaitTimeout(guildId);
    this.errorHistory.delete(guildId);
    const queue = this.queues.get(guildId);
    if (queue) {
      queue.clear();
    }
    await this.engine.disconnect(guildId);
    this.queues.delete(guildId);
    this.mutexes.delete(guildId);
  }

  setLoopMode(guildId: string, mode: LoopMode): void {
    this.getOrCreate(guildId).setLoopMode(mode);
  }

  /** Diagnostic/testing helper to check whether the inactivity timer is active */
  isWaiting(guildId: string): boolean {
    return this.waitTimeouts.has(guildId);
  }
}
