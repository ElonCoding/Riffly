import { describe, expect, it, beforeEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { ModerationRepository } from '../../src/database/repositories/moderation-repository.js';
import type { ModerationCase, GuildSettings } from '../../src/database/types.js';

function createMockPrismaClient(): PrismaClient {
  const guildStore = new Map<string, GuildSettings>();
  const caseStore = new Map<string, ModerationCase>();

  const client = {
    guildSettings: {
      upsert: ({ where, create }: { where: { guildId: string }; create: GuildSettings }) => {
        if (!guildStore.has(where.guildId)) {
          guildStore.set(where.guildId, {
            guildId: create.guildId,
            prefix: '!',
            locale: 'en',
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
        return Promise.resolve(guildStore.get(where.guildId)!);
      },
    },
    moderationCase: {
      findFirst: ({ where }: { where: { guildId: string } }) => {
        const matches = Array.from(caseStore.values()).filter(
          (c) => c.guildId === where.guildId,
        );
        matches.sort((a, b) => b.caseNumber - a.caseNumber);
        return Promise.resolve(matches[0] ?? null);
      },
      create: ({ data }: { data: Omit<ModerationCase, 'id' | 'createdAt'> }) => {
        const record: ModerationCase = {
          ...data,
          id: `case_${Date.now()}_${Math.random()}`,
          reason: data.reason ?? null,
          durationMs: data.durationMs ?? null,
          createdAt: new Date(),
        };
        caseStore.set(`${record.guildId}:${record.caseNumber}`, record);
        return Promise.resolve(record);
      },
      findUnique: ({
        where,
      }: {
        where: { guildId_caseNumber: { guildId: string; caseNumber: number } };
      }) => {
        const key = `${where.guildId_caseNumber.guildId}:${where.guildId_caseNumber.caseNumber}`;
        return Promise.resolve(caseStore.get(key) ?? null);
      },
      findMany: ({
        where,
        take,
        skip = 0,
      }: {
        where: { guildId: string; targetId?: string };
        take?: number;
        skip?: number;
      }) => {
        let matches = Array.from(caseStore.values()).filter(
          (c) => c.guildId === where.guildId,
        );
        if (where.targetId) {
          matches = matches.filter((c) => c.targetId === where.targetId);
        }
        matches.sort((a, b) => b.caseNumber - a.caseNumber);
        const sliced = matches.slice(skip, take ? skip + take : undefined);
        return Promise.resolve(sliced);
      },
      update: ({
        where,
        data,
      }: {
        where: { guildId_caseNumber: { guildId: string; caseNumber: number } };
        data: Partial<ModerationCase>;
      }) => {
        const key = `${where.guildId_caseNumber.guildId}:${where.guildId_caseNumber.caseNumber}`;
        const existing = caseStore.get(key);
        if (!existing) {
          throw new Error('Record not found');
        }
        const updated: ModerationCase = {
          ...existing,
          ...data,
        };
        caseStore.set(key, updated);
        return Promise.resolve(updated);
      },
      count: ({ where }: { where: { guildId: string } }) => {
        const count = Array.from(caseStore.values()).filter(
          (c) => c.guildId === where.guildId,
        ).length;
        return Promise.resolve(count);
      },
    },
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
      return fn(client);
    },
  };

  return client as unknown as PrismaClient;
}

describe('ModerationRepository', () => {
  let repository: ModerationRepository;

  beforeEach(() => {
    repository = new ModerationRepository(createMockPrismaClient());
  });

  it('creates cases with auto-incrementing case numbers per guild', async () => {
    const case1 = await repository.createCase({
      guildId: 'g1',
      targetId: 'u100',
      moderatorId: 'mod1',
      action: 'warn',
      reason: 'Spamming channels',
    });

    expect(case1.caseNumber).toBe(1);
    expect(case1.action).toBe('warn');
    expect(case1.targetId).toBe('u100');
    expect(case1.reason).toBe('Spamming channels');

    const case2 = await repository.createCase({
      guildId: 'g1',
      targetId: 'u200',
      moderatorId: 'mod1',
      action: 'mute',
      reason: 'Excessive caps',
      durationMs: BigInt(600000),
    });

    expect(case2.caseNumber).toBe(2);
    expect(case2.durationMs).toBe(BigInt(600000));

    // Another guild starts at 1
    const caseOther = await repository.createCase({
      guildId: 'g2',
      targetId: 'u300',
      moderatorId: 'mod2',
      action: 'ban',
    });

    expect(caseOther.caseNumber).toBe(1);
  });

  it('retrieves cases by caseNumber and targetId', async () => {
    await repository.createCase({
      guildId: 'g1',
      targetId: 'u100',
      moderatorId: 'mod1',
      action: 'warn',
      reason: 'Rule 1',
    });

    await repository.createCase({
      guildId: 'g1',
      targetId: 'u100',
      moderatorId: 'mod1',
      action: 'timeout',
      reason: 'Rule 2',
    });

    const singleCase = await repository.getCase('g1', 2);
    expect(singleCase?.action).toBe('timeout');

    const notFound = await repository.getCase('g1', 999);
    expect(notFound).toBeNull();

    const targetCases = await repository.getCasesForTarget('g1', 'u100');
    expect(targetCases).toHaveLength(2);
    expect(targetCases[0]?.caseNumber).toBe(2);
    expect(targetCases[1]?.caseNumber).toBe(1);
  });

  it('updates reason and status of existing cases', async () => {
    await repository.createCase({
      guildId: 'g1',
      targetId: 'u100',
      moderatorId: 'mod1',
      action: 'ban',
      reason: 'Pending review',
    });

    const updated = await repository.updateCase('g1', 1, {
      reason: 'Verified raid participant',
      active: false,
    });

    expect(updated?.reason).toBe('Verified raid participant');
    expect(updated?.active).toBe(false);

    const nonExistent = await repository.updateCase('g1', 99, { active: false });
    expect(nonExistent).toBeNull();
  });

  it('counts and paginates guild cases', async () => {
    for (let i = 0; i < 5; i++) {
      await repository.createCase({
        guildId: 'g1',
        targetId: `user_${i}`,
        moderatorId: 'mod1',
        action: 'warn',
      });
    }

    const total = await repository.countCases('g1');
    expect(total).toBe(5);

    const page1 = await repository.getGuildCases('g1', 2, 0);
    expect(page1).toHaveLength(2);
    expect(page1[0]?.caseNumber).toBe(5);
    expect(page1[1]?.caseNumber).toBe(4);

    const page2 = await repository.getGuildCases('g1', 2, 2);
    expect(page2).toHaveLength(2);
    expect(page2[0]?.caseNumber).toBe(3);
    expect(page2[1]?.caseNumber).toBe(2);
  });
});

