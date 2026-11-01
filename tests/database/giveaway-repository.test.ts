import { describe, expect, it, beforeEach } from 'vitest';
import type { Giveaway, GuildSettings, PrismaClient } from '@prisma/client';
import { GiveawayRepository } from '../../src/database/repositories/giveaway-repository.js';

function createMockPrismaClient(): PrismaClient {
  const guildStore = new Map<string, GuildSettings>();
  const giveawayStore = new Map<string, Giveaway>();

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
    giveaway: {
      create: ({ data }: { data: Omit<Giveaway, 'id' | 'createdAt'> }) => {
        const record: Giveaway = {
          ...data,
          id: `gw_${Date.now()}_${Math.random()}`,
          createdAt: new Date(),
        };
        giveawayStore.set(record.messageId, record);
        return Promise.resolve(record);
      },
      findUnique: ({ where }: { where: { messageId: string } }) => {
        return Promise.resolve(giveawayStore.get(where.messageId) ?? null);
      },
      update: ({
        where,
        data,
      }: {
        where: { messageId: string };
        data: Partial<Giveaway> & { entries?: { push?: string } | string[] };
      }) => {
        const existing = giveawayStore.get(where.messageId);
        if (!existing) throw new Error('Not found');

        let newEntries = existing.entries;
        if (data.entries) {
          if (Array.isArray(data.entries)) {
            newEntries = data.entries;
          } else {
            const pushVal = (data.entries as { push?: string }).push;
            if (pushVal) {
              newEntries = [...newEntries, pushVal];
            }
          }
        }

        const updated: Giveaway = {
          ...existing,
          ...data,
          entries: newEntries,
        };
        giveawayStore.set(where.messageId, updated);
        return Promise.resolve(updated);
      },
      findMany: ({ where }: { where?: { ended?: boolean; guildId?: string } }) => {
        let results = Array.from(giveawayStore.values());
        if (where?.ended !== undefined) {
          results = results.filter((g) => g.ended === where.ended);
        }
        if (where?.guildId) {
          results = results.filter((g) => g.guildId === where.guildId);
        }
        return Promise.resolve(results);
      },
    },
  } as unknown as PrismaClient;

  return client;
}

describe('GiveawayRepository', () => {
  let repository: GiveawayRepository;

  beforeEach(() => {
    repository = new GiveawayRepository(createMockPrismaClient());
  });

  it('creates and retrieves a giveaway', async () => {
    const endsAt = new Date(Date.now() + 3600000);
    const created = await repository.createGiveaway({
      guildId: 'guild-1',
      channelId: 'chan-1',
      messageId: 'msg-1',
      prize: 'Discord Nitro',
      winnersCount: 1,
      hostId: 'host-1',
      endsAt,
    });

    expect(created.prize).toBe('Discord Nitro');
    expect(created.ended).toBe(false);
    expect(created.entries).toEqual([]);

    const fetched = await repository.getGiveaway('msg-1');
    expect(fetched).not.toBeNull();
    expect(fetched?.prize).toBe('Discord Nitro');
  });

  it('adds and removes participant entries without duplicates', async () => {
    await repository.createGiveaway({
      guildId: 'guild-1',
      channelId: 'chan-1',
      messageId: 'msg-2',
      prize: 'Steam Gift Card',
      winnersCount: 2,
      hostId: 'host-1',
      endsAt: new Date(Date.now() + 10000),
    });

    // Add entry
    const entry1 = await repository.addEntry('msg-2', 'user-1');
    expect(entry1.added).toBe(true);
    expect(entry1.totalEntries).toBe(1);

    // Duplicate entry is rejected
    const dup = await repository.addEntry('msg-2', 'user-1');
    expect(dup.added).toBe(false);
    expect(dup.totalEntries).toBe(1);

    // Add second user
    const entry2 = await repository.addEntry('msg-2', 'user-2');
    expect(entry2.added).toBe(true);
    expect(entry2.totalEntries).toBe(2);

    // Remove first user
    const removed = await repository.removeEntry('msg-2', 'user-1');
    expect(removed.removed).toBe(true);
    expect(removed.totalEntries).toBe(1);
  });

  it('ends a giveaway and records winner IDs', async () => {
    await repository.createGiveaway({
      guildId: 'guild-1',
      channelId: 'chan-1',
      messageId: 'msg-3',
      prize: 'Game Pass',
      winnersCount: 1,
      hostId: 'host-1',
      endsAt: new Date(Date.now() + 1000),
    });

    await repository.addEntry('msg-3', 'user-winner');
    const ended = await repository.endGiveaway('msg-3', ['user-winner']);

    expect(ended.ended).toBe(true);
    expect(ended.winners).toEqual(['user-winner']);

    // Entry after ending is rejected
    const postEnd = await repository.addEntry('msg-3', 'user-late');
    expect(postEnd.added).toBe(false);
  });
});
