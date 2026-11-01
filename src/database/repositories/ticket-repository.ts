import type { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../client.js';
import type { CreateTicketInput, ITicketRepository, TicketData } from '../types.js';

/**
 * Repository managing support tickets, states, claims, and resolution lifecycles.
 */
export class TicketRepository implements ITicketRepository {
  private readonly client: PrismaClient;

  constructor(client?: PrismaClient) {
    this.client = client ?? getPrismaClient();
  }

  /**
   * Creates a new ticket record.
   */
  public async createTicket(data: CreateTicketInput): Promise<TicketData> {
    // Ensure guildSettings exists for foreign key
    await this.client.guildSettings.upsert({
      where: { guildId: data.guildId },
      update: {},
      create: { guildId: data.guildId },
    });

    const record = await this.client.ticket.create({
      data: {
        guildId: data.guildId,
        channelId: data.channelId,
        creatorId: data.creatorId,
        category: data.category ?? null,
        status: 'open',
      },
    });

    return {
      id: record.id,
      guildId: record.guildId,
      channelId: record.channelId,
      creatorId: record.creatorId,
      claimedBy: record.claimedBy,
      status: record.status,
      category: record.category,
      createdAt: record.createdAt,
      closedAt: record.closedAt,
    };
  }

  /**
   * Retrieves ticket details by channel ID.
   */
  public async getTicketByChannel(guildId: string, channelId: string): Promise<TicketData | null> {
    const record = await this.client.ticket.findFirst({
      where: {
        guildId,
        channelId,
      },
    });

    if (!record) return null;

    return {
      id: record.id,
      guildId: record.guildId,
      channelId: record.channelId,
      creatorId: record.creatorId,
      claimedBy: record.claimedBy,
      status: record.status,
      category: record.category,
      createdAt: record.createdAt,
      closedAt: record.closedAt,
    };
  }

  /**
   * Retrieves ticket details by ticket ID.
   */
  public async getTicketById(ticketId: string): Promise<TicketData | null> {
    const record = await this.client.ticket.findUnique({
      where: { id: ticketId },
    });

    if (!record) return null;

    return {
      id: record.id,
      guildId: record.guildId,
      channelId: record.channelId,
      creatorId: record.creatorId,
      claimedBy: record.claimedBy,
      status: record.status,
      category: record.category,
      createdAt: record.createdAt,
      closedAt: record.closedAt,
    };
  }

  /**
   * Assigns a ticket to a moderator.
   */
  public async claimTicket(ticketId: string, moderatorId: string): Promise<TicketData | null> {
    try {
      const record = await this.client.ticket.update({
        where: { id: ticketId },
        data: { claimedBy: moderatorId },
      });

      return {
        id: record.id,
        guildId: record.guildId,
        channelId: record.channelId,
        creatorId: record.creatorId,
        claimedBy: record.claimedBy,
        status: record.status,
        category: record.category,
        createdAt: record.createdAt,
        closedAt: record.closedAt,
      };
    } catch {
      return null;
    }
  }

  /**
   * Unclaims a previously claimed ticket.
   */
  public async unclaimTicket(ticketId: string): Promise<TicketData | null> {
    try {
      const record = await this.client.ticket.update({
        where: { id: ticketId },
        data: { claimedBy: null },
      });

      return {
        id: record.id,
        guildId: record.guildId,
        channelId: record.channelId,
        creatorId: record.creatorId,
        claimedBy: record.claimedBy,
        status: record.status,
        category: record.category,
        createdAt: record.createdAt,
        closedAt: record.closedAt,
      };
    } catch {
      return null;
    }
  }

  /**
   * Closes a ticket.
   */
  public async closeTicket(ticketId: string): Promise<TicketData | null> {
    try {
      const record = await this.client.ticket.update({
        where: { id: ticketId },
        data: {
          status: 'closed',
          closedAt: new Date(),
        },
      });

      return {
        id: record.id,
        guildId: record.guildId,
        channelId: record.channelId,
        creatorId: record.creatorId,
        claimedBy: record.claimedBy,
        status: record.status,
        category: record.category,
        createdAt: record.createdAt,
        closedAt: record.closedAt,
      };
    } catch {
      return null;
    }
  }

  /**
   * Reopens a closed ticket.
   */
  public async reopenTicket(ticketId: string): Promise<TicketData | null> {
    try {
      const record = await this.client.ticket.update({
        where: { id: ticketId },
        data: {
          status: 'open',
          closedAt: null,
        },
      });

      return {
        id: record.id,
        guildId: record.guildId,
        channelId: record.channelId,
        creatorId: record.creatorId,
        claimedBy: record.claimedBy,
        status: record.status,
        category: record.category,
        createdAt: record.createdAt,
        closedAt: record.closedAt,
      };
    } catch {
      return null;
    }
  }

  /**
   * Lists tickets for a guild with optional status filtering and pagination.
   */
  public async listGuildTickets(
    guildId: string,
    status?: string,
    limit = 50,
    offset = 0,
  ): Promise<TicketData[]> {
    const records = await this.client.ticket.findMany({
      where: {
        guildId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return records.map((record) => ({
      id: record.id,
      guildId: record.guildId,
      channelId: record.channelId,
      creatorId: record.creatorId,
      claimedBy: record.claimedBy,
      status: record.status,
      category: record.category,
      createdAt: record.createdAt,
      closedAt: record.closedAt,
    }));
  }
}
