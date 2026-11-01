import type { GiveawayData } from '../../database/types.js';

export interface GiveawaySettings {
  enabled?: boolean;
  managerRoleId?: string;
}

export interface StartGiveawayOptions {
  guildId: string;
  channelId: string;
  prize: string;
  durationMs: number;
  winnersCount: number;
  hostId: string;
}

export interface EndGiveawayResult {
  giveaway: GiveawayData;
  winners: string[];
}
