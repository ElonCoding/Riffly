import type { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../client.js';
import type { IEconomyRepository, UserEconomyData } from '../types.js';

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Repository managing member economy wallets, bank deposits, daily streaks, and coin transfers.
 */
export class EconomyRepository implements IEconomyRepository {
  private readonly client: PrismaClient;

  constructor(client?: PrismaClient) {
    this.client = client ?? getPrismaClient();
  }

  /**
   * Retrieves or initializes member economy records.
   */
  public async getEconomy(guildId: string, userId: string): Promise<UserEconomyData> {
    const record = await this.client.userEconomy.findUnique({
      where: { guildId_userId: { guildId, userId } },
    });

    if (record) {
      return {
        guildId: record.guildId,
        userId: record.userId,
        wallet: record.wallet,
        bank: record.bank,
        lastDaily: record.lastDaily,
        lastWork: record.lastWork,
      };
    }

    await this.client.guildSettings.upsert({
      where: { guildId },
      update: {},
      create: { guildId },
    });

    const created = await this.client.userEconomy.create({
      data: {
        guildId,
        userId,
        wallet: 0n,
        bank: 0n,
      },
    });

    return {
      guildId: created.guildId,
      userId: created.userId,
      wallet: created.wallet,
      bank: created.bank,
      lastDaily: created.lastDaily,
      lastWork: created.lastWork,
    };
  }

  /**
   * Adds coins directly to a member's wallet balance.
   */
  public async addWallet(
    guildId: string,
    userId: string,
    amount: bigint,
  ): Promise<UserEconomyData> {
    await this.getEconomy(guildId, userId);

    const updated = await this.client.userEconomy.update({
      where: { guildId_userId: { guildId, userId } },
      data: {
        wallet: { increment: amount },
      },
    });

    return {
      guildId: updated.guildId,
      userId: updated.userId,
      wallet: updated.wallet,
      bank: updated.bank,
      lastDaily: updated.lastDaily,
      lastWork: updated.lastWork,
    };
  }

  /**
   * Deposits coins from wallet into bank account.
   */
  public async deposit(
    guildId: string,
    userId: string,
    amount: bigint,
  ): Promise<{ success: boolean; data?: UserEconomyData; error?: string }> {
    const current = await this.getEconomy(guildId, userId);
    if (current.wallet < amount) {
      return { success: false, error: 'Insufficient wallet balance.' };
    }

    const updated = await this.client.userEconomy.update({
      where: { guildId_userId: { guildId, userId } },
      data: {
        wallet: { decrement: amount },
        bank: { increment: amount },
      },
    });

    return {
      success: true,
      data: {
        guildId: updated.guildId,
        userId: updated.userId,
        wallet: updated.wallet,
        bank: updated.bank,
        lastDaily: updated.lastDaily,
        lastWork: updated.lastWork,
      },
    };
  }

  /**
   * Withdraws coins from bank account into wallet balance.
   */
  public async withdraw(
    guildId: string,
    userId: string,
    amount: bigint,
  ): Promise<{ success: boolean; data?: UserEconomyData; error?: string }> {
    const current = await this.getEconomy(guildId, userId);
    if (current.bank < amount) {
      return { success: false, error: 'Insufficient bank balance.' };
    }

    const updated = await this.client.userEconomy.update({
      where: { guildId_userId: { guildId, userId } },
      data: {
        bank: { decrement: amount },
        wallet: { increment: amount },
      },
    });

    return {
      success: true,
      data: {
        guildId: updated.guildId,
        userId: updated.userId,
        wallet: updated.wallet,
        bank: updated.bank,
        lastDaily: updated.lastDaily,
        lastWork: updated.lastWork,
      },
    };
  }

  /**
   * Transfers coins between two members in the same guild.
   */
  public async transfer(
    guildId: string,
    fromUserId: string,
    toUserId: string,
    amount: bigint,
  ): Promise<{ success: boolean; error?: string }> {
    if (fromUserId === toUserId) {
      return { success: false, error: 'Cannot transfer coins to yourself.' };
    }
    if (amount <= 0n) {
      return { success: false, error: 'Transfer amount must be positive.' };
    }

    const sender = await this.getEconomy(guildId, fromUserId);
    if (sender.wallet < amount) {
      return { success: false, error: 'Insufficient wallet funds.' };
    }

    await this.getEconomy(guildId, toUserId);

    await this.client.$transaction([
      this.client.userEconomy.update({
        where: { guildId_userId: { guildId, userId: fromUserId } },
        data: { wallet: { decrement: amount } },
      }),
      this.client.userEconomy.update({
        where: { guildId_userId: { guildId, userId: toUserId } },
        data: { wallet: { increment: amount } },
      }),
    ]);

    return { success: true };
  }

  /**
   * Claims daily coins once every 24 hours.
   */
  public async claimDaily(
    guildId: string,
    userId: string,
    rewardAmount: bigint,
  ): Promise<{ claimed: boolean; nextClaimAt?: Date; data?: UserEconomyData }> {
    const current = await this.getEconomy(guildId, userId);
    const now = new Date();

    if (current.lastDaily) {
      const elapsed = now.getTime() - current.lastDaily.getTime();
      if (elapsed < TWENTY_FOUR_HOURS_MS) {
        const nextClaimAt = new Date(current.lastDaily.getTime() + TWENTY_FOUR_HOURS_MS);
        return { claimed: false, nextClaimAt, data: current };
      }
    }

    const updated = await this.client.userEconomy.update({
      where: { guildId_userId: { guildId, userId } },
      data: {
        wallet: { increment: rewardAmount },
        lastDaily: now,
      },
    });

    return {
      claimed: true,
      data: {
        guildId: updated.guildId,
        userId: updated.userId,
        wallet: updated.wallet,
        bank: updated.bank,
        lastDaily: updated.lastDaily,
        lastWork: updated.lastWork,
      },
    };
  }

  /**
   * Performs work to earn coins with 1-hour cooldown.
   */
  public async work(
    guildId: string,
    userId: string,
    minReward: bigint,
    maxReward: bigint,
  ): Promise<{ worked: boolean; reward?: bigint; nextWorkAt?: Date; data?: UserEconomyData }> {
    const current = await this.getEconomy(guildId, userId);
    const now = new Date();

    if (current.lastWork) {
      const elapsed = now.getTime() - current.lastWork.getTime();
      if (elapsed < ONE_HOUR_MS) {
        const nextWorkAt = new Date(current.lastWork.getTime() + ONE_HOUR_MS);
        return { worked: false, nextWorkAt, data: current };
      }
    }

    const minNum = Number(minReward);
    const maxNum = Number(maxReward);
    const earned = BigInt(Math.floor(Math.random() * (maxNum - minNum + 1)) + minNum);

    const updated = await this.client.userEconomy.update({
      where: { guildId_userId: { guildId, userId } },
      data: {
        wallet: { increment: earned },
        lastWork: now,
      },
    });

    return {
      worked: true,
      reward: earned,
      data: {
        guildId: updated.guildId,
        userId: updated.userId,
        wallet: updated.wallet,
        bank: updated.bank,
        lastDaily: updated.lastDaily,
        lastWork: updated.lastWork,
      },
    };
  }

  /**
   * Retrieves top richest members in the server.
   */
  public async getLeaderboard(guildId: string, limit = 10): Promise<UserEconomyData[]> {
    const records = await this.client.userEconomy.findMany({
      where: { guildId },
      orderBy: { wallet: 'desc' },
      take: limit,
    });

    return records.map((r) => ({
      guildId: r.guildId,
      userId: r.userId,
      wallet: r.wallet,
      bank: r.bank,
      lastDaily: r.lastDaily,
      lastWork: r.lastWork,
    }));
  }
}

