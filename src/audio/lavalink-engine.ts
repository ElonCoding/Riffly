import { EventEmitter } from 'node:events';
import { LavalinkManager } from 'lavalink-client';
import type { Client } from 'discord.js';
import type { AppConfig } from '../config.js';
import type { MusicEngine, MusicEngineEvents, PlayerState, Track } from './types.js';

export interface LavalinkMusicEngineOptions {
  readonly client: Client;
  readonly config: AppConfig;
  readonly manager?: LavalinkManager;
}

function normalizeLavalinkTrack(track: unknown): Track | undefined {
  if (!track || typeof track !== 'object') {
    return undefined;
  }
  const raw = track as {
    encoded?: string | null;
    info?: {
      title?: string | null;
      author?: string | null;
      duration?: number | null;
      identifier?: string | null;
      isSeekable?: boolean | null;
      isStream?: boolean | null;
      uri?: string | null;
      artworkUrl?: string | null;
    } | null;
  };

  const uri = raw.info?.uri;
  const artworkUrl = raw.info?.artworkUrl;

  return {
    encoded: raw.encoded ?? '',
    title: raw.info?.title ?? 'Unknown title',
    author: raw.info?.author ?? 'Unknown artist',
    lengthMs: raw.info?.duration ?? 0,
    identifier: raw.info?.identifier ?? '',
    isSeekable: Boolean(raw.info?.isSeekable),
    isStream: Boolean(raw.info?.isStream),
    ...(typeof uri === 'string' && uri.length > 0 ? { uri } : {}),
    ...(typeof artworkUrl === 'string' && artworkUrl.length > 0 ? { artworkUrl } : {}),
  };
}

export class LavalinkMusicEngine extends EventEmitter implements MusicEngine {
  readonly manager: LavalinkManager;
  private readonly client: Client;

  constructor(options: LavalinkMusicEngineOptions) {
    super();
    this.client = options.client;

    this.manager =
      options.manager ??
      new LavalinkManager({
        nodes: [
          {
            authorization: options.config.lavalink.password,
            host: options.config.lavalink.host,
            port: options.config.lavalink.port,
            secure: options.config.lavalink.secure,
            id: 'primary-node',
            retryAmount: 30,
            retryDelay: 5000,
          },
        ],
        sendToShard: (guildId, payload) => {
          this.client.guilds.cache.get(guildId)?.shard?.send(payload);
        },
        client: {
          id: options.config.discordClientId,
          username: 'Riffly',
        },
      });

    this.wireEvents();
  }

  private wireEvents(): void {
    // Forward raw Discord voice state/server packets to LavalinkManager
    this.client.on('raw', (packet: unknown) => {
      void this.manager.sendRawData(packet as Parameters<typeof this.manager.sendRawData>[0]);
    });

    // Map Lavalink node lifecycle events
    this.manager.nodeManager.on('connect', (node) => {
      console.log(
        `[MusicEngine] Successfully connected to Lavalink node: ${node.id} (${node.options.host}:${node.options.port}, secure: ${node.options.secure})`,
      );
      this.emit('nodeConnect', node.id);
    });

    this.manager.nodeManager.on('disconnect', (node, reason) => {
      const reasonStr =
        typeof reason === 'string' ? reason : reason instanceof Error ? reason.message : undefined;
      console.warn(
        `[MusicEngine] Disconnected from Lavalink node ${node.id}: ${reasonStr ?? 'unknown'}`,
      );
      this.emit('nodeDisconnect', node.id, reasonStr);
    });

    this.manager.nodeManager.on('error', (node, error) => {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[MusicEngine] Lavalink node ${node.id} error: ${msg}`);
    });

    this.manager.nodeManager.on('reconnecting', (node) => {
      console.log(
        `[MusicEngine] Reconnecting to Lavalink node: ${node.id} (${node.options.host}:${node.options.port})...`,
      );
    });

    // Map Lavalink player/track events
    this.manager.on('trackStart', (player, track) => {
      const normalized = normalizeLavalinkTrack(track);
      if (normalized) {
        this.emit('trackStart', player.guildId, normalized);
      }
    });

    this.manager.on('trackEnd', (player, track, payload) => {
      const normalized = normalizeLavalinkTrack(track);
      if (normalized) {
        this.emit('trackEnd', player.guildId, normalized, payload?.reason ?? 'finished');
      }
    });

    this.manager.on('trackError', (player, track, payload) => {
      const error = new Error(payload?.exception?.message ?? 'Lavalink track playback error');
      this.emit('trackError', player.guildId, normalizeLavalinkTrack(track), error);
    });

    this.manager.on('playerDisconnect', (player) => {
      this.emit('playerDisconnect', player.guildId);
    });
  }

  async init(): Promise<void> {
    const clientId = this.client.user?.id ?? this.client.application?.id ?? '';
    const node = this.manager.nodeManager.nodes.get('primary-node');
    const endpointDesc = node
      ? `${node.options.host}:${node.options.port} (secure: ${node.options.secure})`
      : 'configured node';
    console.log(`[MusicEngine] Connecting to Lavalink at ${endpointDesc} as client ${clientId}...`);
    await this.manager.init({
      id: clientId,
      username: this.client.user?.username ?? 'Riffly',
    });
  }

  getState(guildId: string): PlayerState {
    const player = this.manager.getPlayer(guildId);
    if (!player || !player.connected) {
      return 'disconnected';
    }
    if (player.paused) {
      return 'paused';
    }
    if (player.playing) {
      return 'playing';
    }
    return 'idle';
  }

  async connect(guildId: string, voiceChannelId: string): Promise<void> {
    const player =
      this.manager.getPlayer(guildId) ??
      this.manager.createPlayer({
        guildId,
        voiceChannelId,
      });

    if (player.voiceChannelId !== voiceChannelId) {
      player.voiceChannelId = voiceChannelId;
    }

    if (!player.connected) {
      await player.connect();
    }
  }

  async disconnect(guildId: string): Promise<void> {
    const player = this.manager.getPlayer(guildId);
    if (!player) {
      return;
    }
    await player.disconnect();
  }

  async play(guildId: string, track: Track): Promise<void> {
    const player = this.manager.getPlayer(guildId);
    if (!player || !player.connected) {
      throw new Error(
        `Cannot play: player for guild ${guildId} is not connected to a voice channel`,
      );
    }

    await player.play({
      track: {
        encoded: track.encoded,
      },
    });
  }

  async pause(guildId: string): Promise<void> {
    const player = this.manager.getPlayer(guildId);
    if (!player || !player.playing) {
      throw new Error(`Cannot pause: player for guild ${guildId} is not currently playing`);
    }
    await player.pause();
  }

  async resume(guildId: string): Promise<void> {
    const player = this.manager.getPlayer(guildId);
    if (!player || !player.paused) {
      throw new Error(`Cannot resume: player for guild ${guildId} is not paused`);
    }
    await player.resume();
  }

  async stop(guildId: string): Promise<void> {
    const player = this.manager.getPlayer(guildId);
    if (!player) {
      return;
    }
    await player.stopPlaying();
  }

  async seek(guildId: string, positionMs: number): Promise<void> {
    const player = this.manager.getPlayer(guildId);
    if (!player) {
      throw new Error(`Cannot seek: player not found for guild ${guildId}`);
    }
    await player.seek(positionMs);
  }

  async setVolume(guildId: string, volume: number): Promise<void> {
    const player = this.manager.getPlayer(guildId);
    if (!player) {
      throw new Error(`Cannot set volume: player not found for guild ${guildId}`);
    }
    await player.setVolume(volume);
  }

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
