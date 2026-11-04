import { EventEmitter } from 'node:events';
import {
  AudioPlayer,
  AudioPlayerStatus,
  AudioResource,
  NoSubscriberBehavior,
  VoiceConnection,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  getVoiceConnection,
  joinVoiceChannel,
  StreamType,
} from '@discordjs/voice';
import { Ytdl } from '@distube/ytdl-core';
import type { Client } from 'discord.js';
import type {
  AudioFilterPreset,
  MusicEngine,
  PlayerState,
  Track,
} from './types.js';
import { RifflyError } from '../errors.js';

export interface NativeVoiceEngineOptions {
  readonly client: Client;
}

/**
 * Native in-process audio engine using @discordjs/voice and @distube/ytdl-core.
 * Operates with Zero Java, Zero Docker, and direct UDP voice streaming.
 */
export class NativeVoiceMusicEngine extends EventEmitter implements MusicEngine {
  private readonly client: Client;
  private readonly ytdl: Ytdl;
  private readonly connections = new Map<string, VoiceConnection>();
  private readonly players = new Map<string, AudioPlayer>();
  private readonly resources = new Map<string, AudioResource>();
  private readonly currentTracks = new Map<string, Track>();
  private readonly volumes = new Map<string, number>();
  private readonly voiceChannelIds = new Map<string, string>();
  private readonly playbackStartTimes = new Map<string, number>();
  private readonly pauseStartTimes = new Map<string, number>();

  readonly isNative = true;

  constructor(options: NativeVoiceEngineOptions) {
    super();
    this.client = options.client;
    this.ytdl = new Ytdl();
  }

  getVoiceChannelId(guildId: string): string | undefined {
    return this.voiceChannelIds.get(guildId);
  }

  getCurrentTrack(guildId: string): Track | undefined {
    return this.currentTracks.get(guildId);
  }

  hasPlayer(guildId: string): boolean {
    return this.players.has(guildId);
  }

  isConnected(guildId: string): boolean {
    const connection = this.connections.get(guildId) ?? getVoiceConnection(guildId);
    return connection?.state.status === VoiceConnectionStatus.Ready;
  }

  async init(): Promise<void> {
    console.log('[NativeAudioEngine] Native @discordjs/voice engine ready.');
    this.emit('nodeConnect', 'native-node');
  }

  async connect(guildId: string, voiceChannelId: string): Promise<void> {
    const guild = this.client.guilds.cache.get(guildId);
    if (!guild) {
      throw RifflyError.notInVoiceChannel();
    }

    let connection = getVoiceConnection(guildId);

    if (
      !connection ||
      connection.state.status === VoiceConnectionStatus.Destroyed ||
      connection.state.status === VoiceConnectionStatus.Disconnected
    ) {
      const newConn = joinVoiceChannel({
        channelId: voiceChannelId,
        guildId,
        adapterCreator: guild.voiceAdapterCreator as Parameters<typeof joinVoiceChannel>[0]['adapterCreator'],
        selfDeaf: true,
        selfMute: false,
      });

      connection = newConn;
      this.connections.set(guildId, newConn);
      this.voiceChannelIds.set(guildId, voiceChannelId);

      newConn.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
          await Promise.race([
            entersState(newConn, VoiceConnectionStatus.Signalling, 5_000),
            entersState(newConn, VoiceConnectionStatus.Connecting, 5_000),
          ]);
        } catch {
          this.cleanupGuild(guildId);
          this.emit('playerDisconnect', guildId);
        }
      });

      newConn.on(VoiceConnectionStatus.Destroyed, () => {
        this.cleanupGuild(guildId);
        this.emit('playerDisconnect', guildId);
      });
    }

    const readyConn = connection;
    if (!readyConn) {
      throw RifflyError.notInVoiceChannel();
    }

    try {
      await entersState(readyConn, VoiceConnectionStatus.Ready, 10_000);
      this.emit('playerConnect', guildId);
    } catch {
      this.cleanupGuild(guildId);
      throw new Error(`Voice connection timeout for guild ${guildId} after 10000ms`);
    }
  }

  async join(guildId: string, voiceChannelId: string): Promise<void> {
    return this.connect(guildId, voiceChannelId);
  }

  async disconnect(guildId: string): Promise<void> {
    const connection = this.connections.get(guildId) ?? getVoiceConnection(guildId);
    if (connection) {
      connection.destroy();
    }
    this.cleanupGuild(guildId);
    this.emit('playerDisconnect', guildId);
  }

  async leave(guildId: string): Promise<void> {
    return this.disconnect(guildId);
  }

  async play(guildId: string, track: Track): Promise<void> {
    const connection = this.connections.get(guildId) ?? getVoiceConnection(guildId);
    if (!connection || connection.state.status !== VoiceConnectionStatus.Ready) {
      const channelId = this.voiceChannelIds.get(guildId);
      if (!channelId) {
        throw RifflyError.notInVoiceChannel();
      }
      await this.connect(guildId, channelId);
    }

    const activeConnection = this.connections.get(guildId) ?? getVoiceConnection(guildId);
    if (!activeConnection) {
      throw RifflyError.notInVoiceChannel();
    }

    const player = this.getOrCreatePlayer(guildId);
    activeConnection.subscribe(player);

    let targetUrl =
      track.uri ??
      (track.identifier.startsWith('http')
        ? track.identifier
        : `https://www.youtube.com/watch?v=${track.identifier}`);

    // If targetUrl is an unresolved Spotify/Apple Music query
    if (
      targetUrl.startsWith('ytsearch:') ||
      targetUrl.includes('results?search_query=') ||
      targetUrl.includes('open.spotify.com') ||
      targetUrl.includes('music.apple.com')
    ) {
      const query =
        track.identifier.replace(/^ytsearch:/, '') || `${track.author} - ${track.title}`;
      try {
        const ytRes = await this.ytdl.search(query, { limit: 1 });
        if (ytRes && ytRes[0]?.url) {
          targetUrl = ytRes[0].url;
        }
      } catch (err) {
        console.warn('[NativeAudioEngine] Failed to resolve query for stream:', err);
      }
    }

    try {
      let audioStream: import('node:stream').Readable;

      if (targetUrl.includes('youtube.com') || targetUrl.includes('youtu.be')) {
        audioStream = this.ytdl.download(targetUrl, {
          filter: { hasAudio: true, hasVideo: false },
          quality: 'highestaudio',
          highWaterMark: 1 << 25,
        });
      } else {
        // Direct stream / other source URL
        const response = await fetch(targetUrl);
        if (!response.ok || !response.body) {
          throw new Error(`Failed to fetch audio stream: ${response.statusText}`);
        }
        audioStream = response.body as unknown as import('node:stream').Readable;
      }

      audioStream.on('error', (err: unknown) => {
        const error = err instanceof Error ? err : new Error(String(err));
        if (
          (error as unknown as { code?: string }).code === 'ERR_STREAM_PREMATURE_CLOSE' ||
          error.message.includes('Premature close') ||
          audioStream.destroyed
        ) {
          return;
        }
        if (this.currentTracks.get(guildId) !== track) {
          return;
        }
        console.error(`[NativeAudioEngine] Audio stream error in guild ${guildId}:`, error);
        this.emit('trackError', guildId, track, error);
      });

      const resource = createAudioResource(audioStream, {
        inputType: StreamType.Arbitrary,
        inlineVolume: true,
      });

      resource.playStream.on('error', (err: unknown) => {
        const error = err instanceof Error ? err : new Error(String(err));
        if (
          (error as unknown as { code?: string }).code === 'ERR_STREAM_PREMATURE_CLOSE' ||
          error.message.includes('Premature close') ||
          resource.playStream.destroyed
        ) {
          return;
        }
        if (this.currentTracks.get(guildId) !== track) {
          return;
        }
        console.error(`[NativeAudioEngine] Resource playStream error in guild ${guildId}:`, error);
        this.emit('trackError', guildId, track, error);
      });

      const currentVol = this.volumes.get(guildId) ?? 100;
      resource.volume?.setVolume(currentVol / 100);

      this.resources.set(guildId, resource);
      this.currentTracks.set(guildId, track);
      this.playbackStartTimes.set(guildId, Date.now());
      this.pauseStartTimes.delete(guildId);

      player.play(resource);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error(`[NativeAudioEngine] Failed to play track in guild ${guildId}:`, error);
      this.emit('trackError', guildId, track, error);
      throw error;
    }
  }

  async pause(guildId: string): Promise<void> {
    const player = this.players.get(guildId);
    if (player && player.state.status === AudioPlayerStatus.Playing) {
      this.pauseStartTimes.set(guildId, Date.now());
      player.pause();
    }
  }

  async resume(guildId: string): Promise<void> {
    const player = this.players.get(guildId);
    if (player && player.state.status === AudioPlayerStatus.Paused) {
      const pausedAt = this.pauseStartTimes.get(guildId);
      if (pausedAt) {
        const pauseDuration = Date.now() - pausedAt;
        const currentStart = this.playbackStartTimes.get(guildId) ?? Date.now();
        this.playbackStartTimes.set(guildId, currentStart + pauseDuration);
        this.pauseStartTimes.delete(guildId);
      }
      player.unpause();
    }
  }

  async stop(guildId: string): Promise<void> {
    this.currentTracks.delete(guildId);
    this.resources.delete(guildId);
    this.playbackStartTimes.delete(guildId);
    this.pauseStartTimes.delete(guildId);
    const player = this.players.get(guildId);
    if (player) {
      player.stop(true);
    }
  }

  async seek(_guildId: string, _positionMs: number): Promise<void> {
    // Native seek will re-trigger stream with offset if requested
  }

  async setVolume(guildId: string, volume: number): Promise<void> {
    const clamped = Math.max(0, Math.min(200, volume));
    this.volumes.set(guildId, clamped);
    const resource = this.resources.get(guildId);
    if (resource?.volume) {
      resource.volume.setVolume(clamped / 100);
    }
  }

  async setFilter(_guildId: string, _preset: AudioFilterPreset): Promise<void> {
    // Filters supported via ffmpeg args in native stream pipeline
  }

  getPosition(guildId: string): number {
    const resource = this.resources.get(guildId);
    if (!resource) {
      return 0;
    }

    if (resource.playbackDuration && resource.playbackDuration > 0) {
      return resource.playbackDuration;
    }

    const startedAt = this.playbackStartTimes.get(guildId);
    if (startedAt) {
      const pausedAt = this.pauseStartTimes.get(guildId);
      if (pausedAt) {
        return Math.max(0, pausedAt - startedAt);
      }
      return Math.max(0, Date.now() - startedAt);
    }

    return 0;
  }

  getState(guildId: string): PlayerState {
    const connection = this.connections.get(guildId) ?? getVoiceConnection(guildId);
    if (!connection || connection.state.status === VoiceConnectionStatus.Destroyed) {
      return 'disconnected';
    }

    const player = this.players.get(guildId);
    if (!player) {
      return 'idle';
    }

    switch (player.state.status) {
      case AudioPlayerStatus.Playing:
        return 'playing';
      case AudioPlayerStatus.Paused:
        return 'paused';
      case AudioPlayerStatus.Buffering:
        return 'buffering';
      case AudioPlayerStatus.Idle:
      default:
        return 'idle';
    }
  }

  private getOrCreatePlayer(guildId: string): AudioPlayer {
    let player = this.players.get(guildId);
    if (!player) {
      player = createAudioPlayer({
        behaviors: {
          noSubscriber: NoSubscriberBehavior.Pause,
        },
      });

      player.on(AudioPlayerStatus.Playing, () => {
        if (!this.playbackStartTimes.has(guildId)) {
          this.playbackStartTimes.set(guildId, Date.now());
        }
        const track = this.currentTracks.get(guildId);
        if (track) {
          this.emit('trackStart', guildId, track);
        }
      });

      player.on(AudioPlayerStatus.Idle, () => {
        const track = this.currentTracks.get(guildId);
        if (track) {
          this.currentTracks.delete(guildId);
          this.emit('trackEnd', guildId, track, 'finished');
        }
      });

      player.on('error', (err) => {
        const track = this.currentTracks.get(guildId);
        if (
          (err as unknown as { code?: string }).code === 'ERR_STREAM_PREMATURE_CLOSE' ||
          err.message.includes('Premature close')
        ) {
          return;
        }
        console.error(`[NativeAudioEngine] Player error in guild ${guildId}:`, err);
        this.emit('trackError', guildId, track, err);
      });

      this.players.set(guildId, player);
    }
    return player;
  }

  private cleanupGuild(guildId: string): void {
    const player = this.players.get(guildId);
    if (player) {
      player.stop(true);
      this.players.delete(guildId);
    }
    this.connections.delete(guildId);
    this.resources.delete(guildId);
    this.currentTracks.delete(guildId);
    this.voiceChannelIds.delete(guildId);
    this.playbackStartTimes.delete(guildId);
    this.pauseStartTimes.delete(guildId);
  }
}
