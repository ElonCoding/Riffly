import type { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../client.js';
import type {
  CreateModerationCaseInput,
  IModerationRepository,
  ModerationCaseData,
} from '../types.js';

/**
 * Repository managing moderation cases, audit trails, and sanction histories.
 */
export class ModerationRepository implements IModerationRepository {
  private readonly client: PrismaClient;

  constructor(client?: PrismaClient) {
    this.client = client ?? getPrismaClient();
  }

  /**
   * Creates a new moderation case with an atomically incremented case number for the guild.
   */
  public async createCase(data: CreateModerationCaseInput): Promise<ModerationCaseData> {
    return this.client.$transaction(async (tx) => {
      // Ensure guild record exists for foreign key constraint
      await tx.guildSettings.upsert({
        where: { guildId: data.guildId },
        update: {},
        create: { guildId: data.guildId },
      });

      const highest = await tx.moderationCase.findFirst({
        where: { guildId: data.guildId },
        orderBy: { caseNumber: 'desc' },
        select: { caseNumber: true },
      });

      const nextCaseNumber = (highest?.caseNumber ?? 0) + 1;

      const created = await tx.moderationCase.create({
        data: {
          guildId: data.guildId,
          caseNumber: nextCaseNumber,
          targetId: data.targetId,
          moderatorId: data.moderatorId,
          action: data.action,
          reason: data.reason ?? null,
          durationMs: data.durationMs ?? null,
          active: true,
        },
      });

      return {
        id: created.id,
        caseNumber: created.caseNumber,
        guildId: created.guildId,
        targetId: created.targetId,
        moderatorId: created.moderatorId,
        action: created.action,
        reason: created.reason,
        durationMs: created.durationMs,
        active: created.active,
        createdAt: created.createdAt,
      };
    });
  }

  /**
   * Retrieves an individual moderation case by guild ID and case number.
   */
  public async getCase(guildId: string, caseNumber: number): Promise<ModerationCaseData | null> {
    const record = await this.client.moderationCase.findUnique({
      where: {
        guildId_caseNumber: {
          guildId,
          caseNumber,
        },
      },
    });

    if (!record) {
      return null;
    }

    return {
      id: record.id,
      caseNumber: record.caseNumber,
      guildId: record.guildId,
      targetId: record.targetId,
      moderatorId: record.moderatorId,
      action: record.action,
      reason: record.reason,
      durationMs: record.durationMs,
      active: record.active,
      createdAt: record.createdAt,
    };
  }

  /**
   * Retrieves past cases for a specific target user in a guild.
   */
  public async getCasesForTarget(
    guildId: string,
    targetId: string,
    limit = 50,
  ): Promise<ModerationCaseData[]> {
    const records = await this.client.moderationCase.findMany({
      where: {
        guildId,
        targetId,
      },
      orderBy: { caseNumber: 'desc' },
      take: limit,
    });

    return records.map((record) => ({
      id: record.id,
      caseNumber: record.caseNumber,
      guildId: record.guildId,
      targetId: record.targetId,
      moderatorId: record.moderatorId,
      action: record.action,
      reason: record.reason,
      durationMs: record.durationMs,
      active: record.active,
      createdAt: record.createdAt,
    }));
  }

  /**
   * Retrieves recent moderation cases across an entire guild.
   */
  public async getGuildCases(
    guildId: string,
    limit = 50,
    offset = 0,
  ): Promise<ModerationCaseData[]> {
    const records = await this.client.moderationCase.findMany({
      where: { guildId },
      orderBy: { caseNumber: 'desc' },
      take: limit,
      skip: offset,
    });

    return records.map((record) => ({
      id: record.id,
      caseNumber: record.caseNumber,
      guildId: record.guildId,
      targetId: record.targetId,
      moderatorId: record.moderatorId,
      action: record.action,
      reason: record.reason,
      durationMs: record.durationMs,
      active: record.active,
      createdAt: record.createdAt,
    }));
  }

  /**
   * Updates an existing case reason or active status.
   */
  public async updateCase(
    guildId: string,
    caseNumber: number,
    data: { reason?: string | null; active?: boolean },
  ): Promise<ModerationCaseData | null> {
    try {
      const updated = await this.client.moderationCase.update({
        where: {
          guildId_caseNumber: {
            guildId,
            caseNumber,
          },
        },
        data: {
          ...(data.reason !== undefined ? { reason: data.reason } : {}),
          ...(data.active !== undefined ? { active: data.active } : {}),
        },
      });

      return {
        id: updated.id,
        caseNumber: updated.caseNumber,
        guildId: updated.guildId,
        targetId: updated.targetId,
        moderatorId: updated.moderatorId,
        action: updated.action,
        reason: updated.reason,
        durationMs: updated.durationMs,
        active: updated.active,
        createdAt: updated.createdAt,
      };
    } catch {
      return null;
    }
  }

  /**
   * Returns total count of cases registered in a guild.
   */
  public async countCases(guildId: string): Promise<number> {
    return this.client.moderationCase.count({
      where: { guildId },
    });
  }

  /**
   * Deactivates active warnings or sanctions for a member.
   */
  public async clearActiveCases(
    guildId: string,
    targetId: string,
    action?: string,
  ): Promise<number> {
    const res = await this.client.moderationCase.updateMany({
      where: {
        guildId,
        targetId,
        active: true,
        ...(action ? { action } : {}),
      },
      data: {
        active: false,
      },
    });
    return res.count;
  }

  /**
   * Deletes a specific case record.
   */
  public async deleteCase(guildId: string, caseNumber: number): Promise<boolean> {
    try {
      await this.client.moderationCase.delete({
        where: {
          guildId_caseNumber: {
            guildId,
            caseNumber,
          },
        },
      });
      return true;
    } catch {
      return false;
    }
  }
}
