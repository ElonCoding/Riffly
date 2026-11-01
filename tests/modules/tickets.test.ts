import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Guild, GuildMember, TextChannel } from 'discord.js';
import { TicketService, TicketError } from '../../src/modules/tickets/service.js';
import { createTicketsModule } from '../../src/modules/tickets/index.js';
import type { ITicketRepository, TicketData } from '../../src/database/types.js';

describe('TicketService', () => {
  let mockRepo: ITicketRepository;
  let service: TicketService;
  let tickets: TicketData[];

  beforeEach(() => {
    tickets = [];
    mockRepo = {
      createTicket: vi.fn().mockImplementation((input: {
        guildId: string;
        channelId: string;
        creatorId: string;
        category?: string | null;
      }) => {
        const t: TicketData = {
          id: `t_${tickets.length + 1}`,
          guildId: input.guildId,
          channelId: input.channelId,
          creatorId: input.creatorId,
          claimedBy: null,
          status: 'open',
          category: input.category ?? null,
          createdAt: new Date(),
          closedAt: null,
        };
        tickets.push(t);
        return Promise.resolve(t);
      }),
      getTicketByChannel: vi.fn().mockImplementation((_g: string, channelId: string) => {
        return Promise.resolve(tickets.find((t) => t.channelId === channelId) ?? null);
      }),
      getTicketById: vi.fn().mockImplementation((id: string) => {
        return Promise.resolve(tickets.find((t) => t.id === id) ?? null);
      }),
      claimTicket: vi.fn().mockImplementation((id: string, moderatorId: string) => {
        const t = tickets.find((item) => item.id === id);
        if (t) t.claimedBy = moderatorId;
        return Promise.resolve(t ?? null);
      }),
      unclaimTicket: vi.fn(),
      closeTicket: vi.fn().mockImplementation((id: string) => {
        const t = tickets.find((item) => item.id === id);
        if (t) {
          t.status = 'closed';
          t.closedAt = new Date();
        }
        return Promise.resolve(t ?? null);
      }),
      reopenTicket: vi.fn(),
      listGuildTickets: vi.fn().mockImplementation((_g: string, status?: string) => {
        if (status) return Promise.resolve(tickets.filter((t) => t.status === status));
        return Promise.resolve(tickets);
      }),
    };
    service = new TicketService(mockRepo);
  });

  it('creates ticket channel with permissions and control panel', async () => {
    const sendFn = vi.fn().mockResolvedValue({});
    const mockChannel = {
      id: 'c_ticket_1',
      name: 'ticket-test',
      send: sendFn,
    } as unknown as TextChannel;

    const createChannelFn = vi.fn().mockResolvedValue(mockChannel);

    const mockGuild = {
      id: 'g1',
      roles: {
        everyone: { id: 'role_everyone' },
        cache: new Map(),
      },
      members: {
        me: { id: 'bot_id' },
      },
      channels: {
        create: createChannelFn,
      },
    } as unknown as Guild;

    const creator = {
      id: 'user_100',
      user: { username: 'testuser', tag: 'testuser#1234' },
    } as unknown as GuildMember;

    const { channel, ticket } = await service.createTicket(mockGuild, creator, 'Billing Support');

    expect(channel.id).toBe('c_ticket_1');
    expect(ticket.creatorId).toBe('user_100');
    expect(ticket.category).toBe('Billing Support');
    expect(createChannelFn).toHaveBeenCalled();
    expect(sendFn).toHaveBeenCalled();
  });

  it('rejects ticket creation if user already has 3 open tickets', async () => {
    tickets.push(
      { id: '1', guildId: 'g1', channelId: 'c1', creatorId: 'u1', claimedBy: null, status: 'open', category: null, createdAt: new Date(), closedAt: null },
      { id: '2', guildId: 'g1', channelId: 'c2', creatorId: 'u1', claimedBy: null, status: 'open', category: null, createdAt: new Date(), closedAt: null },
      { id: '3', guildId: 'g1', channelId: 'c3', creatorId: 'u1', claimedBy: null, status: 'open', category: null, createdAt: new Date(), closedAt: null },
    );

    const mockGuild = { id: 'g1' } as unknown as Guild;
    const creator = { id: 'u1', user: { username: 'u1' } } as unknown as GuildMember;

    await expect(service.createTicket(mockGuild, creator)).rejects.toThrow(TicketError);
  });

  it('closes an active ticket and updates permissions', async () => {
    tickets.push({
      id: 't1',
      guildId: 'g1',
      channelId: 'c1',
      creatorId: 'u1',
      claimedBy: null,
      status: 'open',
      category: null,
      createdAt: new Date(),
      closedAt: null,
    });

    const editPermsFn = vi.fn().mockResolvedValue({});
    const sendFn = vi.fn().mockResolvedValue({});
    const mockChannel = {
      id: 'c1',
      guild: { id: 'g1' },
      send: sendFn,
      permissionOverwrites: {
        edit: editPermsFn,
      },
    } as unknown as TextChannel;

    const mod = { id: 'mod1' } as unknown as GuildMember;

    const closed = await service.closeTicket(mockChannel, mod);
    expect(closed.status).toBe('closed');
    expect(editPermsFn).toHaveBeenCalledWith('u1', expect.any(Object));
  });

  it('claims an active ticket', async () => {
    tickets.push({
      id: 't1',
      guildId: 'g1',
      channelId: 'c1',
      creatorId: 'u1',
      claimedBy: null,
      status: 'open',
      category: null,
      createdAt: new Date(),
      closedAt: null,
    });

    const sendFn = vi.fn().mockResolvedValue({});
    const mockChannel = {
      id: 'c1',
      guild: { id: 'g1' },
      send: sendFn,
    } as unknown as TextChannel;

    const mod = { id: 'staff_1' } as unknown as GuildMember;
    const claimed = await service.claimTicket(mockChannel, mod);
    expect(claimed.claimedBy).toBe('staff_1');
  });

  it('exports formatted transcript of messages', async () => {
    const mockMessages = new Map([
      [
        'm1',
        {
          id: 'm1',
          createdAt: new Date('2026-11-01T10:00:00Z'),
          author: { tag: 'User#1234', id: 'u1' },
          content: 'Hello I need help with billing',
        },
      ],
      [
        'm2',
        {
          id: 'm2',
          createdAt: new Date('2026-11-01T10:01:00Z'),
          author: { tag: 'Mod#0001', id: 'mod1' },
          content: 'Sure, what is your invoice ID?',
        },
      ],
    ]);

    const fetchMessagesFn = vi.fn().mockResolvedValue(mockMessages);
    const mockChannel = {
      id: 'c1',
      name: 'ticket-billing-01',
      messages: {
        fetch: fetchMessagesFn,
      },
    } as unknown as TextChannel;

    const transcript = await service.exportTranscript(mockChannel);
    expect(transcript).toContain('RIFFLY TICKET TRANSCRIPT');
    expect(transcript).toContain('Hello I need help with billing');
    expect(transcript).toContain('Sure, what is your invoice ID?');
  });

  it('builds valid ticket module definition', () => {
    const modDef = createTicketsModule({ repository: mockRepo });
    expect(modDef.id).toBe('tickets');
    expect(modDef.commands).toHaveLength(1);
    expect(modDef.commands?.[0]?.name).toBe('ticket');
  });
});
