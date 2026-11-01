import type { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../client.js';
import type { ILevelRepository, UserLevelData } from '../types.js';

/**
 * Repository managing user experience, message counts, levels, and leaderboards.
 */
export class LevelRepository implements ILevelRepository {
  private readonly client: PrismaClient;

  constructor(client?: PrismaClient) {
    this.client = client ?? getPrismaClient();
  }

  /**
   * Retrieves user leveling record or returns initial default data.
   */
  public async getUserLevel(guildId: string, userId: string): Promise<UserLevelData> {
    const record = await this.client.userLevel.findUnique({
      where: {
        guildId_userId: {
          guildId,
          userId,
        },
      },
    });

    if (!record) {
      return {
        guildId,
        userId,
        xp: BigInt(0),
        level: 0,
        messagesCount: 0,
        lastXpAt: null,
      };
    }

    return {
      guildId: record.guildId,
      userId: record.userId,
      xp: record.xp,
      level: record.level,
      messagesCount: record.messagesCount,
      lastXpAt: record.lastXpAt,
    };
  }

  /**
   * Adds XP to a user and updates level based on the computed level formula.
   */
  public async addXp(
    guildId: string,
    userId: string,
    amount: number,
    computeLevel: (xp: number) => number,
  ): Promise<{ data: UserLevelData; leveledUp: boolean; oldLevel: number; newLevel: number }> {
    return this.client.$transaction(async (tx) => {
      // Ensure guildSettings exists for foreign key
      await tx.guildSettings.upsert({
        where: { guildId },
        update: {},
        create: { guildId },
      });

      const existing = await tx.userLevel.findUnique({
        where: {
          guildId_userId: {
            guildId,
            userId,
          },
        },
      });

      const oldXp = Number(existing?.xp ?? BigInt(0));
      const oldLevel = existing?.level ?? 0;
      const newXp = oldXp + amount;
      const newLevel = computeLevel(newXp);
      const leveledUp = newLevel > oldLevel;

      const record = await tx.userLevel.upsert({
        where: {
          guildId_userId: {
            guildId,
            userId,
          },
        },
        update: {
          xp: BigInt(newXp),
          level: newLevel,
          messagesCount: (existing?.messagesCount ?? 0) + 1,
          lastXpAt: new Date(),
        },
        create: {
          guildId,
          userId,
          xp: BigInt(newXp),
          level: newLevel,
          messagesCount: 1,
          lastXpAt: new Date(),
        },
      });

      const data: UserLevelData = {
        guildId: record.guildId,
        userId: record.userId,
        xp: record.xp,
        level: record.level,
        messagesCount: record.messagesCount,
        lastXpAt: record.lastXpAt,
      };

      return {
        data,
        leveledUp,
        oldLevel,
        newLevel,
      };
    });
  }

  /**
   * Retrieves the guild leaderboard ordered by XP descending.
   */
  public async getLeaderboard(
    guildId: string,
    limit = 10,
    offset = 0,
  ): Promise<UserLevelData[]> {
    const records = await this.client.userLevel.findMany({
      where: { guildId },
      orderBy: { xp: 'desc' },
      take: limit,
      skip: offset,
    });

    return records.map((record) => ({
      guildId: record.guildId,
      userId: record.userId,
      xp: record.xp,
      level: record.level,
      messagesCount: record.messagesCount,
      lastXpAt: record.lastXpAt,
    }));
  }

  /**
   * Sets a user's level and XP directly (admin/moderator command).
   */
  public async setUserLevel(
    guildId: string,
    userId: string,
    level: number,
    xp: bigint,
  ): Promise<UserLevelData> {
    await this.client.guildSettings.upsert({
      where: { guildId },
      update: {},
      create: { guildId },
    });

    const record = await this.client.userLevel.upsert({
      where: {
        guildId_userId: {
          guildId,
          userId,
        },
      },
      update: {
        level,
        xp,
      },
      create: {
        guildId,
        userId,
        level,
        xp,
        messagesCount: 0,
      },
    });

    return {
      guildId: record.guildId,
      userId: record.userId,
      xp: record.xp,
      level: record.level,
      messagesCount: record.messagesCount,
      lastXpAt: record.lastXpAt,
    };
  }
}
