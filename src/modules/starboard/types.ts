export interface StarboardSettings {
  enabled?: boolean;
  channelId?: string;
  minStars?: number;
  emoji?: string;
  selfStar?: boolean;
}

export interface StarboardContext {
  getSettings?: (guildId: string, moduleId: string) => Promise<Record<string, unknown> | null>;
}
