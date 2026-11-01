import type { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../client.js';

export interface AntiNukeConfig {
  enabled: boolean;
  banThreshold: number;
  kickThreshold: number;
  channelDeleteThreshold: number;
  action: 'ban' | 'kick' | 'strip_roles';
  whitelist: string[];
}

export interface AntiRaidConfig {
  enabled: boolean;
  joinThreshold: number;
  windowSeconds: number;
  action: 'kick' | 'ban' | 'timeout';
  autoLockdown: boolean;
}

export interface AutoModConfig {
  antiSpam: boolean;
  antiLinks: boolean;
  antiCaps: boolean;
  antiMention: boolean;
  capsPercentage: number;
  maxMentions: number;
  maxMessagesPer5s: number;
  bannedWords: string[];
  whitelistedChannels: string[];
  whitelistedRoles: string[];
}

export class PrismaSecurityRepository {
  private readonly client: PrismaClient;

  constructor(client?: PrismaClient) {
    this.client = client ?? getPrismaClient();
  }

  // Anti-Nuke
  public async getAntiNuke(guildId: string): Promise<AntiNukeConfig> {
    const record = await this.client.antiNukeSetting.findUnique({
      where: { guildId },
    });
    if (!record) {
      return {
        enabled: false,
        banThreshold: 3,
        kickThreshold: 5,
        channelDeleteThreshold: 3,
        action: 'ban',
        whitelist: [],
      };
    }
    return {
      enabled: record.enabled,
      banThreshold: record.banThreshold,
      kickThreshold: record.kickThreshold,
      channelDeleteThreshold: record.channelDeleteThreshold,
      action: (record.action as 'ban' | 'kick' | 'strip_roles') || 'ban',
      whitelist: record.whitelist,
    };
  }

  public async setAntiNuke(guildId: string, data: Partial<AntiNukeConfig>): Promise<AntiNukeConfig> {
    await this.ensureGuild(guildId);
    const updated = await this.client.antiNukeSetting.upsert({
      where: { guildId },
      update: {
        ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
        ...(data.banThreshold !== undefined ? { banThreshold: data.banThreshold } : {}),
        ...(data.kickThreshold !== undefined ? { kickThreshold: data.kickThreshold } : {}),
        ...(data.channelDeleteThreshold !== undefined ? { channelDeleteThreshold: data.channelDeleteThreshold } : {}),
        ...(data.action !== undefined ? { action: data.action } : {}),
        ...(data.whitelist !== undefined ? { whitelist: data.whitelist } : {}),
      },
      create: {
        guildId,
        enabled: data.enabled ?? false,
        banThreshold: data.banThreshold ?? 3,
        kickThreshold: data.kickThreshold ?? 5,
        channelDeleteThreshold: data.channelDeleteThreshold ?? 3,
        action: data.action ?? 'ban',
        whitelist: data.whitelist ?? [],
      },
    });

    return {
      enabled: updated.enabled,
      banThreshold: updated.banThreshold,
      kickThreshold: updated.kickThreshold,
      channelDeleteThreshold: updated.channelDeleteThreshold,
      action: (updated.action as 'ban' | 'kick' | 'strip_roles') || 'ban',
      whitelist: updated.whitelist,
    };
  }

  // Anti-Raid
  public async getAntiRaid(guildId: string): Promise<AntiRaidConfig> {
    const record = await this.client.antiRaidSetting.findUnique({
      where: { guildId },
    });
    if (!record) {
      return {
        enabled: false,
        joinThreshold: 10,
        windowSeconds: 10,
        action: 'kick',
        autoLockdown: true,
      };
    }
    return {
      enabled: record.enabled,
      joinThreshold: record.joinThreshold,
      windowSeconds: record.windowSeconds,
      action: (record.action as 'kick' | 'ban' | 'timeout') || 'kick',
      autoLockdown: record.autoLockdown,
    };
  }

  public async setAntiRaid(guildId: string, data: Partial<AntiRaidConfig>): Promise<AntiRaidConfig> {
    await this.ensureGuild(guildId);
    const updated = await this.client.antiRaidSetting.upsert({
      where: { guildId },
      update: {
        ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
        ...(data.joinThreshold !== undefined ? { joinThreshold: data.joinThreshold } : {}),
        ...(data.windowSeconds !== undefined ? { windowSeconds: data.windowSeconds } : {}),
        ...(data.action !== undefined ? { action: data.action } : {}),
        ...(data.autoLockdown !== undefined ? { autoLockdown: data.autoLockdown } : {}),
      },
      create: {
        guildId,
        enabled: data.enabled ?? false,
        joinThreshold: data.joinThreshold ?? 10,
        windowSeconds: data.windowSeconds ?? 10,
        action: data.action ?? 'kick',
        autoLockdown: data.autoLockdown ?? true,
      },
    });

    return {
      enabled: updated.enabled,
      joinThreshold: updated.joinThreshold,
      windowSeconds: updated.windowSeconds,
      action: (updated.action as 'kick' | 'ban' | 'timeout') || 'kick',
      autoLockdown: updated.autoLockdown,
    };
  }

  // AutoMod
  public async getAutoMod(guildId: string): Promise<AutoModConfig> {
    const record = await this.client.autoModSetting.findUnique({
      where: { guildId },
    });
    if (!record) {
      return {
        antiSpam: false,
        antiLinks: false,
        antiCaps: false,
        antiMention: false,
        capsPercentage: 70,
        maxMentions: 5,
        maxMessagesPer5s: 5,
        bannedWords: [],
        whitelistedChannels: [],
        whitelistedRoles: [],
      };
    }
    return {
      antiSpam: record.antiSpam,
      antiLinks: record.antiLinks,
      antiCaps: record.antiCaps,
      antiMention: record.antiMention,
      capsPercentage: record.capsPercentage,
      maxMentions: record.maxMentions,
      maxMessagesPer5s: record.maxMessagesPer5s,
      bannedWords: record.bannedWords,
      whitelistedChannels: record.whitelistedChannels,
      whitelistedRoles: record.whitelistedRoles,
    };
  }

  public async setAutoMod(guildId: string, data: Partial<AutoModConfig>): Promise<AutoModConfig> {
    await this.ensureGuild(guildId);
    const updated = await this.client.autoModSetting.upsert({
      where: { guildId },
      update: {
        ...(data.antiSpam !== undefined ? { antiSpam: data.antiSpam } : {}),
        ...(data.antiLinks !== undefined ? { antiLinks: data.antiLinks } : {}),
        ...(data.antiCaps !== undefined ? { antiCaps: data.antiCaps } : {}),
        ...(data.antiMention !== undefined ? { antiMention: data.antiMention } : {}),
        ...(data.capsPercentage !== undefined ? { capsPercentage: data.capsPercentage } : {}),
        ...(data.maxMentions !== undefined ? { maxMentions: data.maxMentions } : {}),
        ...(data.maxMessagesPer5s !== undefined ? { maxMessagesPer5s: data.maxMessagesPer5s } : {}),
        ...(data.bannedWords !== undefined ? { bannedWords: data.bannedWords } : {}),
        ...(data.whitelistedChannels !== undefined ? { whitelistedChannels: data.whitelistedChannels } : {}),
        ...(data.whitelistedRoles !== undefined ? { whitelistedRoles: data.whitelistedRoles } : {}),
      },
      create: {
        guildId,
        antiSpam: data.antiSpam ?? false,
        antiLinks: data.antiLinks ?? false,
        antiCaps: data.antiCaps ?? false,
        antiMention: data.antiMention ?? false,
        capsPercentage: data.capsPercentage ?? 70,
        maxMentions: data.maxMentions ?? 5,
        maxMessagesPer5s: data.maxMessagesPer5s ?? 5,
        bannedWords: data.bannedWords ?? [],
        whitelistedChannels: data.whitelistedChannels ?? [],
        whitelistedRoles: data.whitelistedRoles ?? [],
      },
    });

    return {
      antiSpam: updated.antiSpam,
      antiLinks: updated.antiLinks,
      antiCaps: updated.antiCaps,
      antiMention: updated.antiMention,
      capsPercentage: updated.capsPercentage,
      maxMentions: updated.maxMentions,
      maxMessagesPer5s: updated.maxMessagesPer5s,
      bannedWords: updated.bannedWords,
      whitelistedChannels: updated.whitelistedChannels,
      whitelistedRoles: updated.whitelistedRoles,
    };
  }

  private async ensureGuild(guildId: string): Promise<void> {
    await this.client.guildSettings.upsert({
      where: { guildId },
      update: {},
      create: { guildId },
    });
  }
}
