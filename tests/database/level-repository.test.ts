import { describe, expect, it, beforeEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { LevelRepository } from '../../src/database/repositories/level-repository.js';
import type { UserLevel, GuildSettings } from '../../src/database/types.js';

function createMockPrismaClient(): PrismaClient {
  const guildStore = new Map<string, GuildSettings>();
  const levelStore = new Map<string, UserLevel>();

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
    userLevel: {
      findUnique: ({
        where,
      }: {
        where: { guildId_userId: { guildId: string; userId: string } };
      }) => {
        const key = `${where.guildId_userId.guildId}:${where.guildId_userId.userId}`;
        return Promise.resolve(levelStore.get(key) ?? null);
      },
      upsert: ({
        where,
        update,
        create,
      }: {
        where: { guildId_userId: { guildId: string; userId: string } };
        update: Partial<UserLevel>;
        create: UserLevel;
      }) => {
        const key = `${where.guildId_userId.guildId}:${where.guildId_userId.userId}`;
        const existing = levelStore.get(key);
        if (existing) {
          const updated: UserLevel = {
            ...existing,
            ...update,
          };
          levelStore.set(key, updated);
          return Promise.resolve(updated);
        }
        const created: UserLevel = {
          guildId: create.guildId,
          userId: create.userId,
          xp: create.xp,
          level: create.level,
          messagesCount: create.messagesCount ?? 1,
          lastXpAt: create.lastXpAt ?? new Date(),
        };
        levelStore.set(key, created);
        return Promise.resolve(created);
      },
      findMany: ({
        where,
        take,
        skip = 0,
      }: {
        where: { guildId: string };
        take?: number;
        skip?: number;
      }) => {
        const matches = Array.from(levelStore.values()).filter(
          (l) => l.guildId === where.guildId,
        );
        matches.sort((a, b) => Number(b.xp - a.xp));
        const sliced = matches.slice(skip, take ? skip + take : undefined);
        return Promise.resolve(sliced);
      },
    },
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => {
      return fn(client);
    },
  };

  return client as unknown as PrismaClient;
}

describe('LevelRepository', () => {
  let repository: LevelRepository;

  beforeEach(() => {
    repository = new LevelRepository(createMockPrismaClient());
  });

  it('retrieves default level for new user', async () => {
    const levelData = await repository.getUserLevel('g1', 'u1');
    expect(levelData.level).toBe(0);
    expect(levelData.xp).toBe(BigInt(0));
    expect(levelData.messagesCount).toBe(0);
  });

  it('adds XP and calculates level up accurately', async () => {
    const formula = (xp: number) => Math.floor(xp / 100);

    const firstAward = await repository.addXp('g1', 'u1', 50, formula);
    expect(firstAward.data.xp).toBe(BigInt(50));
    expect(firstAward.newLevel).toBe(0);
    expect(firstAward.leveledUp).toBe(false);

    const secondAward = await repository.addXp('g1', 'u1', 60, formula);
    expect(secondAward.data.xp).toBe(BigInt(110));
    expect(secondAward.newLevel).toBe(1);
    expect(secondAward.leveledUp).toBe(true);
    expect(secondAward.oldLevel).toBe(0);
  });

  it('returns sorted leaderboard and sets custom user level', async () => {
    await repository.setUserLevel('g1', 'u1', 5, BigInt(1500));
    await repository.setUserLevel('g1', 'u2', 10, BigInt(5000));
    await repository.setUserLevel('g1', 'u3', 2, BigInt(400));

    const leaderboard = await repository.getLeaderboard('g1', 2);
    expect(leaderboard).toHaveLength(2);
    expect(leaderboard[0]?.userId).toBe('u2');
    expect(leaderboard[1]?.userId).toBe('u1');
  });
});
