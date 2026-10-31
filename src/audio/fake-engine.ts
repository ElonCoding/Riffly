import { EventEmitter } from 'node:events';
import type { MusicEngine, MusicEngineEvents, PlayerState, Track } from './types.js';

interface FakePlayer {
  state: PlayerState;
  voiceChannelId: string;
  currentTrack?: Track;
  volume: number;
  position: number;
}

export class FakeMusicEngine extends EventEmitter implements MusicEngine {
  private readonly players = new Map<string, FakePlayer>();

  getState(guildId: string): PlayerState {
    return this.players.get(guildId)?.state ?? 'disconnected';
  }

  getCurrentTrack(guildId: string): Track | undefined {
    return this.players.get(guildId)?.currentTrack;
  }

  getVolume(guildId: string): number {
    return this.players.get(guildId)?.volume ?? 100;
  }

  setPlayerState(guildId: string, state: PlayerState): void {
    const player = this.players.get(guildId);
    if (player) {
      player.state = state;
    }
  }

  setBuffering(guildId: string): void {
    this.setPlayerState(guildId, 'buffering');
  }

  connect(guildId: string, voiceChannelId: string): Promise<void> {
    if (!voiceChannelId || voiceChannelId.trim().length === 0) {
      return Promise.reject(new Error('Invalid voice channel ID'));
    }
    const player = this.players.get(guildId);
    if (player) {
      player.voiceChannelId = voiceChannelId;
      if (player.state === 'disconnected') {
        player.state = 'idle';
      }
    } else {
      this.players.set(guildId, {
        state: 'idle',
        voiceChannelId,
        volume: 100,
        position: 0,
      });
    }
    return Promise.resolve();
  }

  join(guildId: string, voiceChannelId: string): Promise<void> {
    return this.connect(guildId, voiceChannelId);
  }

  disconnect(guildId: string): Promise<void> {
    const player = this.players.get(guildId);
    if (!player || player.state === 'disconnected') {
      return Promise.resolve();
    }
    player.state = 'disconnected';
    delete player.currentTrack;
    player.position = 0;
    this.emit('playerDisconnect', guildId);
    return Promise.resolve();
  }

  leave(guildId: string): Promise<void> {
    return this.disconnect(guildId);
  }

  play(guildId: string, track: Track): Promise<void> {
    const player = this.players.get(guildId);
    if (!player || player.state === 'disconnected') {
      return Promise.reject(
        new Error(`Cannot play: player for guild ${guildId} is not connected to a voice channel`),
      );
    }
    player.currentTrack = track;
    player.position = 0;
    player.state = 'playing';
    this.emit('trackStart', guildId, track);
    return Promise.resolve();
  }

  pause(guildId: string): Promise<void> {
    const player = this.players.get(guildId);
    if (!player || player.state !== 'playing') {
      return Promise.reject(
        new Error(`Cannot pause: player for guild ${guildId} is not currently playing`),
      );
    }
    player.state = 'paused';
    return Promise.resolve();
  }

  resume(guildId: string): Promise<void> {
    const player = this.players.get(guildId);
    if (!player || player.state !== 'paused') {
      return Promise.reject(new Error(`Cannot resume: player for guild ${guildId} is not paused`));
    }
    player.state = 'playing';
    return Promise.resolve();
  }

  stop(guildId: string): Promise<void> {
    const player = this.players.get(guildId);
    if (!player || player.state === 'disconnected') {
      return Promise.resolve();
    }
    const hadTrack = player.currentTrack;
    delete player.currentTrack;
    player.position = 0;
    player.state = 'idle';
    if (hadTrack) {
      this.emit('trackEnd', guildId, hadTrack, 'stopped');
    }
    return Promise.resolve();
  }

  seek(guildId: string, positionMs: number): Promise<void> {
    const player = this.players.get(guildId);
    if (!player || !player.currentTrack) {
      return Promise.reject(
        new Error(`Cannot seek: player for guild ${guildId} has no active track`),
      );
    }
    if (positionMs < 0 || positionMs > player.currentTrack.lengthMs) {
      return Promise.reject(new Error(`Invalid seek position: ${positionMs}ms`));
    }
    player.position = positionMs;
    return Promise.resolve();
  }

  setVolume(guildId: string, volume: number): Promise<void> {
    const player = this.players.get(guildId);
    if (!player) {
      return Promise.reject(new Error(`Player not found for guild ${guildId}`));
    }
    if (volume < 0 || volume > 1000) {
      return Promise.reject(new Error('Volume must be between 0 and 1000'));
    }
    player.volume = volume;
    return Promise.resolve();
  }

  getPosition(guildId: string): number {
    return this.players.get(guildId)?.position ?? 0;
  }

  setPlaybackPosition(guildId: string, positionMs: number): void {
    const player = this.players.get(guildId);
    if (player) {
      player.position = positionMs;
    }
  }

  // Type-safe event subscription helpers
  override on<E extends keyof MusicEngineEvents>(event: E, listener: MusicEngineEvents[E]): this {
    return super.on(event, listener as (...args: unknown[]) => void);
  }

  override off<E extends keyof MusicEngineEvents>(event: E, listener: MusicEngineEvents[E]): this {
    return super.off(event, listener as (...args: unknown[]) => void);
  }

  override emit<E extends keyof MusicEngineEvents>(
    event: E,
    ...args: Parameters<MusicEngineEvents[E]>
  ): boolean {
    return super.emit(event, ...args);
  }
}
