import type { Client } from 'discord.js';
import type { GuildPlayerManager } from '../player/guild-player.js';
import type {
  IGuildRepository,
  IModerationRepository,
  ITicketRepository,
  ILevelRepository,
  IEconomyRepository,
  IGiveawayRepository,
} from '../database/types.js';

export interface DashboardServerOptions {
  port?: number;
  host?: string;
  client?: Client;
  playerManager?: GuildPlayerManager;
  guildRepository?: IGuildRepository;
  moderationRepository?: IModerationRepository;
  ticketRepository?: ITicketRepository;
  levelRepository?: ILevelRepository;
  economyRepository?: IEconomyRepository;
  giveawayRepository?: IGiveawayRepository;
}

export interface ApiStatusResponse {
  name: string;
  version: string;
  online: boolean;
  uptimeSeconds: number;
  pingMs: number;
  guildsCount: number;
  usersCount: number;
}

