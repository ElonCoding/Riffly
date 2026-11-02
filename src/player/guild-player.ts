/**
 * GuildPlayerManager.
 *
 * One manager instance per bot process. Maintains one GuildPlayer (queue +
 * engine connection) per guild. Orchestrates voice connection, track loading,
 * concurrency serialization via per-guild AsyncMutex, inactivity disconnect
 * timers, and error recovery circuit breaking.
 */

import { EventEmitter } from 'node:events';
import type { Client } from 'discord.js';
import { GuildQueue } from './queue.js';
import type { LoopMode } from './queue.js';
import { AsyncMutex } from './mutex.js';
import type { AudioFilterPreset, MusicEngine, PlayerState, Track } from '../audio/types.js';
import { RifflyError } from '../errors.js';
import { AutoplayManager } from './autoplay.js';

export interface GuildPlayerState {
  readonly engineState: PlayerState;
  readonly current: Track | undefined;
  readonly upcoming: readonly Track[];
  readonly loopMode: LoopMode;
  readonly volume: number;
  readonly position: number;
}

export interface GuildPlayerManagerOptions {
  readonly waitTimeoutMs?: number;
  readonly autoplayManager?: AutoplayManager;
  readonly client?: Client | undefined;
}

export class GuildPlayerManager extends EventEmitter {
  public static readonly DEFAULT_WAIT_TIMEOUT_MS = 180_000;
  private readonly queues = new Map<string, GuildQueue>();
  private readonly mutexes = new Map<string, AsyncMutex>();
  private readonly waitTimeouts = new Map<string, NodeJS.Timeout>();
  private readonly errorHistory = new Map<string, number[]>();
  private readonly textChannels = new Map<string, string>();
  private readonly client?: Client | undefined;
  public readonly engine: MusicEngine;
  private readonly waitTimeoutMs: number;
  private readonly autoplayManager: AutoplayManager;
  /** Track IDs currently being advanced (deduplication guard). */
  private readonly advancing = new Set<string>();

  /** Records the most recent playback error per guild for diagnostics and status reporting. */
  public readonly lastPlaybackErrors = new Map<
    string,
    { timestamp: number; trackTitle: string; error: string }
  >();

  constructor(engine: MusicEngine, options?: GuildPlayerManagerOptions) {
    super();
    this.engine = engine;
    this.client = options?.client;
    this.waitTimeoutMs = options?.waitTimeoutMs ?? GuildPlayerManager.DEFAULT_WAIT_TIMEOUT_MS;
    this.autoplayManager = options?.autoplayManager ?? new AutoplayManager();

    engine.on('trackStart', (guildId, track) => {
      const queue = this.getOrCreate(guildId);
      queue.setCurrent(track);
      this.emit('trackStart', guildId, track);
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
      if (
        (error as unknown as { code?: string }).code === 'ERR_STREAM_PREMATURE_CLOSE' ||
        error.message?.includes('Premature close') ||
        error.message?.includes('aborted')
      ) {
        console.warn(
          `[GuildPlayer:${guildId}] Suppressed benign stream close for "${track?.title ?? 'unknown'}": ${error.message}`,
        );
        return;
      }

      console.error(
        `[GuildPlayer:${guildId}] Track error for "${track?.title ?? 'unknown'}":`,
        error.message,
      );
      this.lastPlaybackErrors.set(guildId, {
        timestamp: Date.now(),
        trackTitle: track?.title ?? 'Unknown track',
        error: error.message,
      });
      this.emit('trackError', guildId, track, error);
      void this.notifyTrackError(guildId, track, error);
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
      this.textChannels.delete(guildId);
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

      const textChannelId = this.textChannels.get(guildId);
      if (textChannelId) {
        try {
          const client =
            this.client ??
            (this.engine as unknown as { client?: Client })?.client;
          if (client?.channels) {
            const channel =
              client.channels.cache?.get(textChannelId) ??
              (typeof client.channels.fetch === 'function'
                ? await client.channels.fetch(textChannelId).catch(() => null)
                : null);
            if (
              channel &&
              'send' in channel &&
              typeof (channel as { send: unknown }).send === 'function'
            ) {
              await (channel as { send: (payload: unknown) => Promise<unknown> })
                .send({
                  content:
                    '🛑 **Playback halted**: 3 consecutive playback errors occurred within 5 seconds. The queue was cleared to prevent a crash loop. Please try another audio source or search query.',
                })
                .catch(() => {});
            }
          }
        } catch {
          // Ignore text notification failures
        }
      }
      return;
    }

    await this.advanceQueue(guildId, 'error');
  }

  getLastError(
    guildId: string,
  ): { timestamp: number; trackTitle: string; error: string } | undefined {
    return this.lastPlaybackErrors.get(guildId);
  }

  /**
   * Awaits backend trackStart event for the given guild, rejecting on trackError,
   * playerDisconnect, or timeout. Used by commands to provide accurate state feedback.
   */
  async waitForTrackStart(guildId: string, timeoutMs = 8000): Promise<Track> {
    return new Promise((resolve, reject) => {
      let settled = false;

      const cleanup = () => {
        clearTimeout(timer);
        this.off('trackStart', onStart);
        this.off('trackError', onError);
        this.engine.off('playerDisconnect', onDisconnect);
      };

      const onStart = (gId: string, track: Track) => {
        if (gId === guildId && !settled) {
          settled = true;
          cleanup();
          resolve(track);
        }
      };

      const onError = (gId: string, _track: Track | undefined, error: Error) => {
        if (gId === guildId && !settled) {
          if (
            (error as unknown as { code?: string }).code === 'ERR_STREAM_PREMATURE_CLOSE' ||
            error.message?.includes('Premature close') ||
            error.message?.includes('aborted')
          ) {
            return;
          }
          settled = true;
          cleanup();
          reject(error);
        }
      };

      const onDisconnect = (gId: string) => {
        if (gId === guildId && !settled) {
          settled = true;
          cleanup();
          reject(new Error('Voice connection disconnected before playback could start'));
        }
      };

      this.on('trackStart', onStart);
      this.on('trackError', onError);
      this.engine.on('playerDisconnect', onDisconnect);

      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          cleanup();
          reject(new Error(`Playback buffering timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);
    });
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

      // If queue exhausted and autoplay enabled, resolve recommendation
      if (this.autoplayManager.isEnabled(guildId) && queue.current) {
        const recommendation = await this.autoplayManager.getRecommendation(queue.current);
        if (recommendation) {
          queue.enqueue([recommendation]);
          const autoTrack = queue.advance('enqueue');
          if (autoTrack) {
            try {
              await this.engine.play(guildId, autoTrack);
              return;
            } catch (err) {
              console.error(
                `[GuildPlayer:${guildId}] Failed playing autoplay recommendation:`,
                err instanceof Error ? err.message : err,
              );
            }
          }
        }
      }

      // When queue becomes empty/idle, arm inactivity disconnect timer
      this.armWaitTimeout(guildId);
    });
  }

  isAutoplay(guildId: string): boolean {
    return this.autoplayManager.isEnabled(guildId);
  }

  setAutoplay(guildId: string, enabled: boolean): void {
    this.autoplayManager.setEnabled(guildId, enabled);
  }

  toggleAutoplay(guildId: string): boolean {
    return this.autoplayManager.toggle(guildId);
  }

  getState(guildId: string): GuildPlayerState {
    const queue = this.queues.get(guildId);
    return {
      engineState: this.engine.getState(guildId),
      current: queue?.current,
      upcoming: queue?.upcoming ?? [],
      loopMode: queue?.loopMode ?? 'off',
      volume: queue?.volume ?? 100,
      position: this.engine.getPosition(guildId),
    };
  }

  setTextChannelId(guildId: string, channelId: string): void {
    this.textChannels.set(guildId, channelId);
  }

  getTextChannelId(guildId: string): string | undefined {
    return this.textChannels.get(guildId);
  }

  /** Connect to a voice channel. */
  async join(guildId: string, voiceChannelId: string, textChannelId?: string): Promise<void> {
    await this.engine.connect(guildId, voiceChannelId);
    if (textChannelId) {
      this.textChannels.set(guildId, textChannelId);
    }
    this.getOrCreate(guildId);
  }

  /** Enqueue tracks and start playback if idle (protected by per-guild mutex). */
  async play(
    guildId: string,
    tracks: readonly Track[],
    options?: { textChannelId?: string },
  ): Promise<{ started: boolean }> {
    return this.getMutex(guildId).runExclusive(async () => {
      if (options?.textChannelId) {
        this.textChannels.set(guildId, options.textChannelId);
      }
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

  async seek(guildId: string, positionMs: number): Promise<void> {
    return this.getMutex(guildId).runExclusive(async () => {
      const state = this.engine.getState(guildId);
      if (state === 'disconnected') {
        throw RifflyError.notInVoiceChannel();
      }
      const queue = this.queues.get(guildId);
      const track = queue?.current;
      if (!track || state === 'idle') {
        throw RifflyError.notPlaying();
      }
      if (!track.isSeekable) {
        throw RifflyError.invalidInput('Current track is not seekable.');
      }
      if (!Number.isFinite(positionMs) || positionMs < 0 || positionMs > track.lengthMs) {
        throw RifflyError.invalidInput(`Seek position must be between 0 and ${track.lengthMs}ms.`);
      }
      await this.engine.seek(guildId, positionMs);
    });
  }

  async setVolume(guildId: string, volume: number): Promise<void> {
    if (!Number.isFinite(volume) || volume < 0 || volume > 100) {
      throw RifflyError.invalidInput('Volume must be between 0 and 100.');
    }
    const state = this.engine.getState(guildId);
    if (state === 'disconnected') {
      throw RifflyError.notInVoiceChannel();
    }
    const queue = this.getOrCreate(guildId);
    queue.setVolume(volume);
    await this.engine.setVolume(guildId, volume);
  }

  async setFilter(guildId: string, preset: AudioFilterPreset): Promise<void> {
    const state = this.engine.getState(guildId);
    if (state === 'disconnected') {
      throw RifflyError.notInVoiceChannel();
    }
    if ('setFilter' in this.engine && typeof this.engine.setFilter === 'function') {
      await this.engine.setFilter(guildId, preset);
    }
  }

  getVolume(guildId: string): number {
    return this.queues.get(guildId)?.volume ?? 100;
  }

  setLoopMode(guildId: string, mode: LoopMode): LoopMode {
    if (mode !== 'off' && mode !== 'track' && mode !== 'queue') {
      throw RifflyError.invalidInput('Invalid loop mode. Must be "off", "track", or "queue".');
    }
    const queue = this.getOrCreate(guildId);
    queue.setLoopMode(mode);
    return queue.loopMode;
  }

  getLoopMode(guildId: string): LoopMode {
    return this.queues.get(guildId)?.loopMode ?? 'off';
  }

  shuffle(guildId: string): void {
    const queue = this.queues.get(guildId);
    if (!queue || queue.isEmpty) {
      throw RifflyError.emptyQueue();
    }
    queue.shuffle();
  }

  remove(guildId: string, index: number): Track {
    const queue = this.queues.get(guildId);
    if (!queue || queue.isEmpty) {
      throw RifflyError.emptyQueue();
    }
    if (!Number.isInteger(index) || index < 1 || index > queue.length) {
      throw RifflyError.invalidInput(`Track index must be between 1 and ${queue.length}.`);
    }
    return queue.remove(index);
  }

  clear(guildId: string): void {
    const queue = this.queues.get(guildId);
    if (queue) {
      queue.clearUpcoming();
    }
    const state = this.engine.getState(guildId);
    if (state === 'idle' || !queue?.current) {
      this.armWaitTimeout(guildId);
    }
  }

  clearUpcoming(guildId: string): void {
    this.clear(guildId);
  }

  getPlaybackPosition(guildId: string): number {
    return this.engine.getPosition(guildId);
  }

  async leave(guildId: string): Promise<void> {
    this.clearWaitTimeout(guildId);
    this.errorHistory.delete(guildId);
    this.textChannels.delete(guildId);
    const queue = this.queues.get(guildId);
    if (queue) {
      queue.clear();
    }
    await this.engine.disconnect(guildId);
    this.queues.delete(guildId);
    this.mutexes.delete(guildId);
  }

  /** Diagnostic/testing helper to check whether the inactivity timer is active */
  isWaiting(guildId: string): boolean {
    return this.waitTimeouts.has(guildId);
  }

  /**
   * Notifies the configured Discord text channel about track playback errors.
   */
  private async notifyTrackError(
    guildId: string,
    track: Track | undefined,
    error: Error,
  ): Promise<void> {
    const textChannelId = this.textChannels.get(guildId);
    if (!textChannelId) return;

    try {
      const client =
        this.client ??
        (this.engine as unknown as { client?: Client })?.client;
      if (!client?.channels) return;

      const channel =
        client.channels.cache?.get(textChannelId) ??
        (typeof client.channels.fetch === 'function'
          ? await client.channels.fetch(textChannelId).catch(() => null)
          : null);

      if (
        channel &&
        'send' in channel &&
        typeof (channel as { send: unknown }).send === 'function'
      ) {
        const title = track?.title ? `**${track.title}**` : 'Current track';
        await (channel as { send: (payload: unknown) => Promise<unknown> }).send({
          content: `⚠️ Playback error on ${title}: ${error.message || 'Unknown audio playback error'}. Skipping to next track...`,
        }).catch((err: unknown) => {
          console.error(`[GuildPlayer:${guildId}] Failed to send track error notification:`, err);
        });
      }
    } catch (notifyErr) {
      console.error(`[GuildPlayer:${guildId}] Error notifying text channel:`, notifyErr);
    }
  }
}
