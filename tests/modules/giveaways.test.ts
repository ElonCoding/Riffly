import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ButtonInteraction, TextChannel } from 'discord.js';
import { GiveawayService } from '../../src/modules/giveaways/service.js';
import type {
  CreateGiveawayInput,
  IGiveawayRepository,
  GiveawayData,
} from '../../src/database/types.js';

describe('GiveawayService', () => {
  let repository: IGiveawayRepository;
  let service: GiveawayService;
  let mockStore: Map<string, GiveawayData>;
  let addEntryMock: (messageId: string, userId: string) => Promise<{ added: boolean; totalEntries: number }>;
  let removeEntryMock: (messageId: string, userId: string) => Promise<{ removed: boolean; totalEntries: number }>;

  beforeEach(() => {
    mockStore = new Map();

    addEntryMock = vi.fn((messageId: string, userId: string) => {
      const item = mockStore.get(messageId);
      if (!item || item.ended) {
        return Promise.resolve({ added: false, totalEntries: item?.entries.length ?? 0 });
      }
      if (item.entries.includes(userId)) {
        return Promise.resolve({ added: false, totalEntries: item.entries.length });
      }
      item.entries.push(userId);
      return Promise.resolve({ added: true, totalEntries: item.entries.length });
    });

    removeEntryMock = vi.fn((messageId: string, userId: string) => {
      const item = mockStore.get(messageId);
      if (!item || item.ended) {
        return Promise.resolve({ removed: false, totalEntries: item?.entries.length ?? 0 });
      }
      item.entries = item.entries.filter((id) => id !== userId);
      return Promise.resolve({ removed: true, totalEntries: item.entries.length });
    });

    repository = {
      createGiveaway: vi.fn((data: CreateGiveawayInput) => {
        const item: GiveawayData = {
          ...data,
          id: 'gw-1',
          ended: false,
          entries: [],
          winners: [],
          createdAt: new Date(),
        };
        mockStore.set(data.messageId, item);
        return Promise.resolve(item);
      }),
      getGiveaway: vi.fn((messageId: string) => Promise.resolve(mockStore.get(messageId) ?? null)),
      addEntry: addEntryMock,
      removeEntry: removeEntryMock,
      endGiveaway: vi.fn((messageId: string, winners: string[]) => {
        const item = mockStore.get(messageId);
        if (!item) throw new Error('Not found');
        item.ended = true;
        item.winners = winners;
        return Promise.resolve(item);
      }),
      getActiveGiveaways: vi.fn(() =>
        Promise.resolve(Array.from(mockStore.values()).filter((g) => !g.ended)),
      ),
    };

    service = new GiveawayService(repository);
  });

  it('starts a giveaway and creates message with enter button', async () => {
    const sendFn = vi.fn().mockResolvedValue({ id: 'msg-giveaway-1' });
    const channel = { id: 'chan-1', send: sendFn } as unknown as TextChannel;

    const giveaway = await service.startGiveaway(channel, {
      guildId: 'guild-1',
      channelId: 'chan-1',
      prize: 'Discord Nitro 1 Month',
      durationMs: 60000,
      winnersCount: 1,
      hostId: 'host-1',
    });

    expect(giveaway.prize).toBe('Discord Nitro 1 Month');
    expect(giveaway.messageId).toBe('msg-giveaway-1');
    expect(sendFn).toHaveBeenCalled();
    const sendArg = sendFn.mock.calls[0]?.[0] as { embeds?: unknown[]; components?: unknown[] } | undefined;
    expect(sendArg?.embeds?.length).toBeGreaterThan(0);
    expect(sendArg?.components?.length).toBeGreaterThan(0);
  });

  it('handles user entering and leaving a giveaway via button interaction', async () => {
    mockStore.set('msg-123', {
      id: 'gw-1',
      guildId: 'guild-1',
      channelId: 'chan-1',
      messageId: 'msg-123',
      prize: 'Game Key',
      winnersCount: 1,
      hostId: 'host-1',
      endsAt: new Date(Date.now() + 60000),
      ended: false,
      entries: [],
      winners: [],
      createdAt: new Date(),
    });

    const editFn = vi.fn().mockResolvedValue(true);
    const replyFn = vi.fn().mockResolvedValue(true);

    const interaction = {
      message: {
        id: 'msg-123',
        embeds: [{ data: {} }],
        edit: editFn,
      },
      user: { id: 'user-alice' },
      reply: replyFn,
    } as unknown as ButtonInteraction;

    // Enter
    await service.handleEntryInteraction(interaction);
    expect(addEntryMock).toHaveBeenCalledWith('msg-123', 'user-alice');
    const replyArg1 = replyFn.mock.calls[0]?.[0] as { content?: string } | undefined;
    expect(replyArg1?.content).toContain('entered');

    // Leave
    await service.handleEntryInteraction(interaction);
    expect(removeEntryMock).toHaveBeenCalledWith('msg-123', 'user-alice');
    const replyArg2 = replyFn.mock.calls[1]?.[0] as { content?: string } | undefined;
    expect(replyArg2?.content).toContain('left');
  });

  it('picks random unique winners fairly', () => {
    const pool = ['u1', 'u2', 'u3', 'u4', 'u5'];
    const winners = service.pickWinners(pool, 2);

    expect(winners.length).toBe(2);
    expect(pool).toContain(winners[0]);
    expect(pool).toContain(winners[1]);
    expect(winners[0]).not.toBe(winners[1]);
  });

  it('ends a giveaway and picks winners', async () => {
    mockStore.set('msg-end', {
      id: 'gw-2',
      guildId: 'guild-1',
      channelId: 'chan-1',
      messageId: 'msg-end',
      prize: 'Steam Game',
      winnersCount: 1,
      hostId: 'host-1',
      endsAt: new Date(),
      ended: false,
      entries: ['user-bob', 'user-charlie'],
      winners: [],
      createdAt: new Date(),
    });

    const result = await service.endGiveaway('msg-end');
    expect(result).not.toBeNull();
    expect(result?.winners.length).toBe(1);
    expect(['user-bob', 'user-charlie']).toContain(result?.winners[0]);
    expect(result?.giveaway.ended).toBe(true);
  });
});
