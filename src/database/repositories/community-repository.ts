import type { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../client.js';

export interface AutoRoleItem {
  id: string;
  roleId: string;
  targetType: string;
}

export interface ReactionRoleItem {
  id: string;
  channelId: string;
  messageId: string;
  emoji: string;
  roleId: string;
}

export interface VanityRoleItem {
  id: string;
  keyword: string;
  roleId: string;
}

export interface InviteStats {
  joins: number;
  leaves: number;
  fake: number;
  total: number;
}

export interface TimerItem {
  id: string;
  name: string;
  channelId: string;
  durationSeconds: number;
  endsAt: Date;
  paused: boolean;
  remainingSeconds: number | null;
  creatorId: string;
}

export interface AutoResponderItem {
  id: string;
  trigger: string;
  reply: string;
  matchType: string;
}

export interface SocialAlertItem {
  id: string;
  platform: string;
  account: string;
  channelId: string;
}

export class PrismaCommunityRepository {
  private readonly client: PrismaClient;

  constructor(client?: PrismaClient) {
    this.client = client ?? getPrismaClient();
  }

  private async ensureGuild(guildId: string): Promise<void> {
    await this.client.guildSettings.upsert({
      where: { guildId },
      update: {},
      create: { guildId },
    });
  }

  // --- AutoRole ---
  public async addAutoRole(guildId: string, roleId: string, targetType = 'all'): Promise<void> {
    await this.ensureGuild(guildId);
    await this.client.autoRole.upsert({
      where: {
        guildId_roleId_targetType: { guildId, roleId, targetType },
      },
      update: {},
      create: { guildId, roleId, targetType },
    });
  }

  public async removeAutoRole(guildId: string, roleId: string): Promise<boolean> {
    const deleted = await this.client.autoRole.deleteMany({
      where: { guildId, roleId },
    });
    return deleted.count > 0;
  }

  public async listAutoRoles(guildId: string): Promise<AutoRoleItem[]> {
    return this.client.autoRole.findMany({
      where: { guildId },
      select: { id: true, roleId: true, targetType: true },
    });
  }

  // --- ReactionRole ---
  public async addReactionRole(
    guildId: string,
    channelId: string,
    messageId: string,
    emoji: string,
    roleId: string,
  ): Promise<void> {
    await this.ensureGuild(guildId);
    await this.client.reactionRole.create({
      data: { guildId, channelId, messageId, emoji, roleId },
    });
  }

  public async removeReactionRole(guildId: string, messageId: string, emoji: string): Promise<boolean> {
    const deleted = await this.client.reactionRole.deleteMany({
      where: { guildId, messageId, emoji },
    });
    return deleted.count > 0;
  }

  public async deleteReactionRoleByMessage(guildId: string, messageId: string): Promise<boolean> {
    const deleted = await this.client.reactionRole.deleteMany({
      where: { guildId, messageId },
    });
    return deleted.count > 0;
  }

  public async listReactionRoles(guildId: string): Promise<ReactionRoleItem[]> {
    return this.client.reactionRole.findMany({
      where: { guildId },
      select: { id: true, channelId: true, messageId: true, emoji: true, roleId: true },
    });
  }

  // --- VanityRole ---
  public async addVanityRole(guildId: string, keyword: string, roleId: string): Promise<void> {
    await this.ensureGuild(guildId);
    await this.client.vanityRole.upsert({
      where: {
        guildId_keyword: { guildId, keyword: keyword.toLowerCase() },
      },
      update: { roleId },
      create: { guildId, keyword: keyword.toLowerCase(), roleId },
    });
  }

  public async removeVanityRole(guildId: string, keyword: string): Promise<boolean> {
    const deleted = await this.client.vanityRole.deleteMany({
      where: { guildId, keyword: keyword.toLowerCase() },
    });
    return deleted.count > 0;
  }

  public async listVanityRoles(guildId: string): Promise<VanityRoleItem[]> {
    return this.client.vanityRole.findMany({
      where: { guildId },
      select: { id: true, keyword: true, roleId: true },
    });
  }

  // --- Invites ---
  public async getInvites(guildId: string, userId: string): Promise<InviteStats> {
    const record = await this.client.inviteCounter.findUnique({
      where: { guildId_userId: { guildId, userId } },
    });
    if (!record) {
      return { joins: 0, leaves: 0, fake: 0, total: 0 };
    }
    const total = record.joins - record.leaves - record.fake;
    return {
      joins: record.joins,
      leaves: record.leaves,
      fake: record.fake,
      total: Math.max(0, total),
    };
  }

  // --- Timers ---
  public async createTimer(
    guildId: string,
    channelId: string,
    name: string,
    durationSeconds: number,
    creatorId: string,
  ): Promise<TimerItem> {
    await this.ensureGuild(guildId);
    const endsAt = new Date(Date.now() + durationSeconds * 1000);
    const item = await this.client.timer.upsert({
      where: { guildId_name: { guildId, name } },
      update: {
        channelId,
        durationSeconds,
        endsAt,
        paused: false,
        remainingSeconds: null,
        creatorId,
      },
      create: {
        guildId,
        channelId,
        name,
        durationSeconds,
        endsAt,
        creatorId,
      },
    });
    return {
      id: item.id,
      name: item.name,
      channelId: item.channelId,
      durationSeconds: item.durationSeconds,
      endsAt: item.endsAt,
      paused: item.paused,
      remainingSeconds: item.remainingSeconds,
      creatorId: item.creatorId,
    };
  }

  public async listTimers(guildId: string): Promise<TimerItem[]> {
    return this.client.timer.findMany({
      where: { guildId },
      select: {
        id: true,
        name: true,
        channelId: true,
        durationSeconds: true,
        endsAt: true,
        paused: true,
        remainingSeconds: true,
        creatorId: true,
      },
    });
  }

  public async cancelTimer(guildId: string, name: string): Promise<boolean> {
    const deleted = await this.client.timer.deleteMany({
      where: { guildId, name },
    });
    return deleted.count > 0;
  }

  public async pauseTimer(guildId: string, name: string): Promise<boolean> {
    const timer = await this.client.timer.findUnique({
      where: { guildId_name: { guildId, name } },
    });
    if (!timer || timer.paused) return false;

    const remaining = Math.max(0, Math.floor((timer.endsAt.getTime() - Date.now()) / 1000));
    await this.client.timer.update({
      where: { guildId_name: { guildId, name } },
      data: { paused: true, remainingSeconds: remaining },
    });
    return true;
  }

  public async resumeTimer(guildId: string, name: string): Promise<boolean> {
    const timer = await this.client.timer.findUnique({
      where: { guildId_name: { guildId, name } },
    });
    if (!timer || !timer.paused) return false;

    const remaining = timer.remainingSeconds ?? 0;
    const endsAt = new Date(Date.now() + remaining * 1000);
    await this.client.timer.update({
      where: { guildId_name: { guildId, name } },
      data: { paused: false, remainingSeconds: null, endsAt },
    });
    return true;
  }

  // --- Clownboard ---
  public async getClownboard(guildId: string) {
    return this.client.clownboardSetting.findUnique({
      where: { guildId },
    });
  }

  public async setupClownboard(guildId: string, channelId: string, threshold = 3) {
    await this.ensureGuild(guildId);
    return this.client.clownboardSetting.upsert({
      where: { guildId },
      update: { channelId, threshold, enabled: true },
      create: { guildId, channelId, threshold, enabled: true },
    });
  }

  public async disableClownboard(guildId: string) {
    return this.client.clownboardSetting.updateMany({
      where: { guildId },
      data: { enabled: false },
    });
  }

  // --- Counting Channel ---
  public async getCounting(guildId: string) {
    return this.client.countingChannel.findUnique({
      where: { guildId },
    });
  }

  public async setupCounting(guildId: string, channelId: string) {
    await this.ensureGuild(guildId);
    return this.client.countingChannel.upsert({
      where: { guildId },
      update: { channelId },
      create: { guildId, channelId, currentNumber: 0 },
    });
  }

  public async updateCount(guildId: string, currentNumber: number, lastUserId: string) {
    return this.client.countingChannel.update({
      where: { guildId },
      data: { currentNumber, lastUserId },
    });
  }

  public async resetCounting(guildId: string) {
    return this.client.countingChannel.updateMany({
      where: { guildId },
      data: { currentNumber: 0, lastUserId: null },
    });
  }

  public async disableCounting(guildId: string) {
    return this.client.countingChannel.deleteMany({
      where: { guildId },
    });
  }

  // --- AutoResponder ---
  public async addAutoResponder(
    guildId: string,
    trigger: string,
    reply: string,
    matchType = 'exact',
  ): Promise<void> {
    await this.ensureGuild(guildId);
    await this.client.autoResponder.create({
      data: { guildId, trigger: trigger.toLowerCase(), reply, matchType },
    });
  }

  public async removeAutoResponder(guildId: string, trigger: string): Promise<boolean> {
    const deleted = await this.client.autoResponder.deleteMany({
      where: { guildId, trigger: trigger.toLowerCase() },
    });
    return deleted.count > 0;
  }

  public async clearAutoResponders(guildId: string): Promise<number> {
    const deleted = await this.client.autoResponder.deleteMany({
      where: { guildId },
    });
    return deleted.count;
  }

  public async listAutoResponders(guildId: string): Promise<AutoResponderItem[]> {
    return this.client.autoResponder.findMany({
      where: { guildId },
      select: { id: true, trigger: true, reply: true, matchType: true },
    });
  }

  // --- Bump Reminder ---
  public async getBumpReminder(guildId: string) {
    return this.client.bumpReminder.findFirst({
      where: { guildId },
    });
  }

  public async setupBumpReminder(guildId: string, channelId: string) {
    await this.ensureGuild(guildId);
    return this.client.bumpReminder.upsert({
      where: { guildId },
      update: {
        channelId,
        remindAt: new Date(Date.now() + 2 * 3600 * 1000),
      },
      create: {
        guildId,
        channelId,
        remindAt: new Date(Date.now() + 2 * 3600 * 1000),
      },
    });
  }

  public async disableBumpReminder(guildId: string) {
    return this.client.bumpReminder.deleteMany({
      where: { guildId },
    });
  }

  // --- Social Alerts ---
  public async addSocialAlert(
    guildId: string,
    platform: string,
    account: string,
    channelId: string,
  ): Promise<void> {
    await this.ensureGuild(guildId);
    await this.client.socialAlert.create({
      data: {
        guildId,
        platform: platform.toLowerCase(),
        account: account.toLowerCase(),
        channelId,
      },
    });
  }

  public async removeSocialAlert(guildId: string, platform: string, account: string): Promise<boolean> {
    const deleted = await this.client.socialAlert.deleteMany({
      where: {
        guildId,
        platform: platform.toLowerCase(),
        account: account.toLowerCase(),
      },
    });
    return deleted.count > 0;
  }

  public async listSocialAlerts(guildId: string): Promise<SocialAlertItem[]> {
    return this.client.socialAlert.findMany({
      where: { guildId },
      select: { id: true, platform: true, account: true, channelId: true },
    });
  }

  // --- Booster Roles ---
  public async getBoosterRole(guildId: string, userId: string) {
    return this.client.boosterRole.findUnique({
      where: { guildId_userId: { guildId, userId } },
    });
  }

  public async setBoosterRole(
    guildId: string,
    userId: string,
    roleId: string,
  ) {
    await this.ensureGuild(guildId);
    return this.client.boosterRole.upsert({
      where: { guildId_userId: { guildId, userId } },
      update: { roleId },
      create: { guildId, userId, roleId },
    });
  }

  public async deleteBoosterRole(guildId: string, userId: string): Promise<boolean> {
    const deleted = await this.client.boosterRole.deleteMany({
      where: { guildId, userId },
    });
    return deleted.count > 0;
  }
}
