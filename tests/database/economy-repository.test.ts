import { describe, expect, it, beforeEach } from 'vitest';
import type { PrismaClient, UserEconomy, GuildSettings } from '@prisma/client';
import { EconomyRepository } from '../../src/database/repositories/economy-repository.js';

function createMockPrismaClient(): PrismaClient {
  const guildStore = new Map<string, GuildSettings>();
  const econStore = new Map<string, UserEconomy>();

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
    userEconomy: {
      findUnique: ({
        where,
      }: {
        where: { guildId_userId: { guildId: string; userId: string } };
      }) => {
        const key = `${where.guildId_userId.guildId}:${where.guildId_userId.userId}`;
        return Promise.resolve(econStore.get(key) ?? null);
      },
      create: ({ data }: { data: UserEconomy }) => {
        const key = `${data.guildId}:${data.userId}`;
        econStore.set(key, data);
        return Promise.resolve(data);
      },
      update: ({
        where,
        data,
      }: {
        where: { guildId_userId: { guildId: string; userId: string } };
        data: {
          wallet?: { increment?: bigint; decrement?: bigint };
          bank?: { increment?: bigint; decrement?: bigint };
          lastDaily?: Date;
          lastWork?: Date;
        };
      }) => {
        const key = `${where.guildId_userId.guildId}:${where.guildId_userId.userId}`;
        const existing = econStore.get(key);
        if (!existing) throw new Error('Not found');

        let newWallet = existing.wallet;
        if (data.wallet?.increment) newWallet += data.wallet.increment;
        if (data.wallet?.decrement) newWallet -= data.wallet.decrement;

        let newBank = existing.bank;
        if (data.bank?.increment) newBank += data.bank.increment;
        if (data.bank?.decrement) newBank -= data.bank.decrement;

        const updated: UserEconomy = {
          ...existing,
          wallet: newWallet,
          bank: newBank,
          lastDaily: data.lastDaily !== undefined ? data.lastDaily : existing.lastDaily,
          lastWork: data.lastWork !== undefined ? data.lastWork : existing.lastWork,
        };
        econStore.set(key, updated);
        return Promise.resolve(updated);
      },
      findMany: ({ where, take }: { where: { guildId: string }; take?: number }) => {
        const records = Array.from(econStore.values())
          .filter((e) => e.guildId === where.guildId)
          .sort((a, b) => (b.wallet > a.wallet ? 1 : -1))
          .slice(0, take ?? 10);
        return Promise.resolve(records);
      },
    },
    $transaction: (actions: Promise<unknown>[]) => Promise.all(actions),
  } as unknown as PrismaClient;

  return client;
}

describe('EconomyRepository', () => {
  let repository: EconomyRepository;

  beforeEach(() => {
    repository = new EconomyRepository(createMockPrismaClient());
  });

  it('initializes default economy record with 0 coins', async () => {
    const data = await repository.getEconomy('guild-1', 'user-1');
    expect(data.wallet).toBe(0n);
    expect(data.bank).toBe(0n);
  });

  it('adds coins to wallet balance', async () => {
    const updated = await repository.addWallet('guild-1', 'user-1', 500n);
    expect(updated.wallet).toBe(500n);
  });

  it('deposits and withdraws coins between wallet and bank safely', async () => {
    await repository.addWallet('guild-1', 'user-1', 1000n);

    // Deposit 400
    const dep = await repository.deposit('guild-1', 'user-1', 400n);
    expect(dep.success).toBe(true);
    expect(dep.data?.wallet).toBe(600n);
    expect(dep.data?.bank).toBe(400n);

    // Fail deposit exceeding wallet
    const badDep = await repository.deposit('guild-1', 'user-1', 700n);
    expect(badDep.success).toBe(false);

    // Withdraw 200
    const wth = await repository.withdraw('guild-1', 'user-1', 200n);
    expect(wth.success).toBe(true);
    expect(wth.data?.wallet).toBe(800n);
    expect(wth.data?.bank).toBe(200n);
  });

  it('transfers coins between users atomically', async () => {
    await repository.addWallet('guild-1', 'sender-1', 500n);

    const xfer = await repository.transfer('guild-1', 'sender-1', 'receiver-1', 250n);
    expect(xfer.success).toBe(true);

    const s = await repository.getEconomy('guild-1', 'sender-1');
    const r = await repository.getEconomy('guild-1', 'receiver-1');
    expect(s.wallet).toBe(250n);
    expect(r.wallet).toBe(250n);
  });

  it('enforces 24-hour daily claim cooldown', async () => {
    const first = await repository.claimDaily('guild-1', 'user-daily', 200n);
    expect(first.claimed).toBe(true);
    expect(first.data?.wallet).toBe(200n);

    const second = await repository.claimDaily('guild-1', 'user-daily', 200n);
    expect(second.claimed).toBe(false);
    expect(second.nextClaimAt).toBeDefined();
  });
});

