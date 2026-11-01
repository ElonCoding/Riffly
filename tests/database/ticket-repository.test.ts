import { describe, expect, it, beforeEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { TicketRepository } from '../../src/database/repositories/ticket-repository.js';
import type { Ticket, GuildSettings } from '../../src/database/types.js';

function createMockPrismaClient(): PrismaClient {
  const guildStore = new Map<string, GuildSettings>();
  const ticketStore = new Map<string, Ticket>();

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
    ticket: {
      create: ({ data }: { data: Omit<Ticket, 'id' | 'createdAt' | 'closedAt' | 'claimedBy'> }) => {
        const record: Ticket = {
          ...data,
          id: `ticket_${Date.now()}_${Math.random()}`,
          category: data.category ?? null,
          claimedBy: null,
          createdAt: new Date(),
          closedAt: null,
        };
        ticketStore.set(record.id, record);
        return Promise.resolve(record);
      },
      findFirst: ({ where }: { where: { guildId: string; channelId: string } }) => {
        const found = Array.from(ticketStore.values()).find(
          (t) => t.guildId === where.guildId && t.channelId === where.channelId,
        );
        return Promise.resolve(found ?? null);
      },
      findUnique: ({ where }: { where: { id: string } }) => {
        return Promise.resolve(ticketStore.get(where.id) ?? null);
      },
      update: ({ where, data }: { where: { id: string }; data: Partial<Ticket> }) => {
        const existing = ticketStore.get(where.id);
        if (!existing) {
          throw new Error('Ticket not found');
        }
        const updated: Ticket = {
          ...existing,
          ...data,
        };
        ticketStore.set(where.id, updated);
        return Promise.resolve(updated);
      },
      findMany: ({
        where,
        take,
        skip = 0,
      }: {
        where: { guildId: string; status?: string };
        take?: number;
        skip?: number;
      }) => {
        let matches = Array.from(ticketStore.values()).filter(
          (t) => t.guildId === where.guildId,
        );
        if (where.status) {
          matches = matches.filter((t) => t.status === where.status);
        }
        matches.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        const sliced = matches.slice(skip, take ? skip + take : undefined);
        return Promise.resolve(sliced);
      },
    },
  };

  return client as unknown as PrismaClient;
}

describe('TicketRepository', () => {
  let repository: TicketRepository;

  beforeEach(() => {
    repository = new TicketRepository(createMockPrismaClient());
  });

  it('creates and retrieves tickets by channel and id', async () => {
    const created = await repository.createTicket({
      guildId: 'g1',
      channelId: 'c100',
      creatorId: 'u200',
      category: 'Billing',
    });

    expect(created.id).toBeDefined();
    expect(created.channelId).toBe('c100');
    expect(created.status).toBe('open');
    expect(created.category).toBe('Billing');

    const byChannel = await repository.getTicketByChannel('g1', 'c100');
    expect(byChannel?.id).toBe(created.id);

    const byId = await repository.getTicketById(created.id);
    expect(byId?.channelId).toBe('c100');
  });

  it('claims and unclaims tickets', async () => {
    const created = await repository.createTicket({
      guildId: 'g1',
      channelId: 'c101',
      creatorId: 'u200',
    });

    const claimed = await repository.claimTicket(created.id, 'mod1');
    expect(claimed?.claimedBy).toBe('mod1');

    const unclaimed = await repository.unclaimTicket(created.id);
    expect(unclaimed?.claimedBy).toBeNull();
  });

  it('closes and reopens tickets', async () => {
    const created = await repository.createTicket({
      guildId: 'g1',
      channelId: 'c102',
      creatorId: 'u200',
    });

    const closed = await repository.closeTicket(created.id);
    expect(closed?.status).toBe('closed');
    expect(closed?.closedAt).not.toBeNull();

    const reopened = await repository.reopenTicket(created.id);
    expect(reopened?.status).toBe('open');
    expect(reopened?.closedAt).toBeNull();
  });

  it('lists and filters guild tickets', async () => {
    const t1 = await repository.createTicket({ guildId: 'g1', channelId: 'c1', creatorId: 'u1' });
    await repository.createTicket({ guildId: 'g1', channelId: 'c2', creatorId: 'u2' });
    await repository.closeTicket(t1.id);

    const openList = await repository.listGuildTickets('g1', 'open');
    expect(openList).toHaveLength(1);

    const allList = await repository.listGuildTickets('g1');
    expect(allList).toHaveLength(2);
  });
});
