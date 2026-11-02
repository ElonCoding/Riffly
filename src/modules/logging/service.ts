import {
  ChannelType,
  EmbedBuilder,
  type Guild,
  type TextChannel,
} from 'discord.js';
import { getPrismaClient } from '../../database/client.js';

export interface ILoggingStore {
  setLogChannel(guildId: string, logType: string, channelId: string): Promise<void>;
  disableLog(guildId: string, logType: string): Promise<void>;
  getLogChannels(guildId: string): Promise<Record<string, string>>;
}

let defaultLoggingService: LoggingService | undefined;

export function getDefaultLoggingService(): LoggingService {
  if (!defaultLoggingService) {
    defaultLoggingService = new LoggingService();
  }
  return defaultLoggingService;
}

export function setDefaultLoggingService(service: LoggingService): void {
  defaultLoggingService = service;
}

export class LoggingService implements ILoggingStore {
  // In-memory cache for ultra-low latency event routing: Map<guildId, Map<logType, channelId>>
  private readonly cache = new Map<string, Map<string, string>>();

  constructor(private readonly prisma = getPrismaClient()) {}

  async setLogChannel(guildId: string, logType: string, channelId: string): Promise<void> {
    try {
      await this.prisma.guildSettings.upsert({
        where: { guildId },
        create: { guildId },
        update: {},
      });

      await this.prisma.loggingSetting.upsert({
        where: {
          guildId_logType: {
            guildId,
            logType,
          },
        },
        create: {
          guildId,
          logType,
          channelId,
          enabled: true,
        },
        update: {
          channelId,
          enabled: true,
        },
      });
    } catch (err) {
      console.warn(`[LoggingService] Database write error for guild ${guildId} (using cache fallback):`, err);
    }

    const guildMap = this.cache.get(guildId) ?? new Map<string, string>();
    guildMap.set(logType, channelId);
    this.cache.set(guildId, guildMap);
  }

  async disableLog(guildId: string, logType: string): Promise<void> {
    try {
      if (logType === 'all') {
        await this.prisma.loggingSetting.deleteMany({
          where: { guildId },
        });
      } else {
        await this.prisma.loggingSetting.deleteMany({
          where: { guildId, logType },
        });
      }
    } catch (err) {
      console.warn(`[LoggingService] Database delete error for guild ${guildId}:`, err);
    }

    const guildMap = this.cache.get(guildId);
    if (guildMap) {
      if (logType === 'all') {
        guildMap.clear();
      } else {
        guildMap.delete(logType);
      }
    }
  }

  async getLogChannels(guildId: string): Promise<Record<string, string>> {
    let guildMap = this.cache.get(guildId);
    if (!guildMap) {
      guildMap = new Map<string, string>();
      try {
        const rows = await this.prisma.loggingSetting.findMany({
          where: { guildId, enabled: true },
        });
        for (const row of rows) {
          guildMap.set(row.logType, row.channelId);
        }
      } catch {
        // Fallback to cache
      }
      this.cache.set(guildId, guildMap);
    }

    const res: Record<string, string> = {};
    for (const [k, v] of guildMap.entries()) {
      res[k] = v;
    }
    return res;
  }

  /**
   * Dispatches an audit embed to the target channel for the given event type.
   * If a dedicated channel for logType exists, sends there.
   * Otherwise falls back to 'all' log channel.
   */
  async log(guild: Guild, logType: string, embed: EmbedBuilder): Promise<void> {
    const channels = await this.getLogChannels(guild.id);
    const targetChannelId = channels[logType] ?? channels['all'];
    if (!targetChannelId) return;

    try {
      const channel =
        guild.channels.cache.get(targetChannelId) ??
        (await guild.channels.fetch(targetChannelId).catch(() => null));

      if (
        channel &&
        channel.type === ChannelType.GuildText &&
        'send' in channel &&
        typeof (channel as TextChannel).send === 'function'
      ) {
        await (channel as TextChannel).send({ embeds: [embed] }).catch(() => null);
      }
    } catch {
      // Suppress delivery errors to prevent bot disruption
    }
  }
}
