export interface Track {
  readonly encoded: string;
  readonly title: string;
  readonly author: string;
  readonly lengthMs: number;
  readonly identifier: string;
  readonly isSeekable: boolean;
  readonly isStream: boolean;
  readonly uri?: string;
  readonly artworkUrl?: string;
  readonly requesterId?: string;
}

export type PlayerState = 'disconnected' | 'idle' | 'buffering' | 'playing' | 'paused';

export interface MusicEngineEvents {
  readonly trackStart: (guildId: string, track: Track) => void;
  readonly trackEnd: (guildId: string, track: Track, reason: string) => void;
  readonly trackError: (guildId: string, track: Track | undefined, error: Error) => void;
  readonly trackStuck: (guildId: string, track: Track, thresholdMs: number) => void;
  readonly playerConnect: (guildId: string) => void;
  readonly playerDisconnect: (guildId: string) => void;
  readonly nodeConnect: (nodeId: string) => void;
  readonly nodeDisconnect: (nodeId: string, reason?: string) => void;
}

export interface MusicEngine {
  connect(guildId: string, voiceChannelId: string): Promise<void>;
  join(guildId: string, voiceChannelId: string): Promise<void>;
  disconnect(guildId: string): Promise<void>;
  leave(guildId: string): Promise<void>;
  play(guildId: string, track: Track): Promise<void>;
  pause(guildId: string): Promise<void>;
  resume(guildId: string): Promise<void>;
  stop(guildId: string): Promise<void>;
  seek(guildId: string, positionMs: number): Promise<void>;
  setVolume(guildId: string, volume: number): Promise<void>;
  getPosition(guildId: string): number;
  getState(guildId: string): PlayerState;
  on<E extends keyof MusicEngineEvents>(event: E, listener: MusicEngineEvents[E]): this;
  off<E extends keyof MusicEngineEvents>(event: E, listener: MusicEngineEvents[E]): this;
}

export type IMusicEngine = MusicEngine;

