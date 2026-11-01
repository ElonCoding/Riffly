import type { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../client.js';
import type { CreateGiveawayInput, GiveawayData, IGiveawayRepository } from '../types.js';

/**
 * Repository managing giveaways, entry lists, winner tracking, and expiration states.
 */
export class GiveawayRepository implements IGiveawayRepository {
  private readonly client: PrismaClient;

  constructor(client?: PrismaClient) {
    this.client = client ?? getPrismaClient();
  }

  /**
   * Creates a new giveaway record.
   */
  public async createGiveaway(data: CreateGiveawayInput): Promise<GiveawayData> {
    // Ensure guildSettings exists for foreign key constraint
    await this.client.guildSettings.upsert({
      where: { guildId: data.guildId },
      update: {},
      create: { guildId: data.guildId },
    });

    const record = await this.client.giveaway.create({
      data: {
        guildId: data.guildId,
        channelId: data.channelId,
        messageId: data.messageId,
        prize: data.prize,
        winnersCount: data.winnersCount,
        hostId: data.hostId,
        endsAt: data.endsAt,
        ended: false,
        entries: [],
        winners: [],
      },
    });

    return {
      id: record.id,
      guildId: record.guildId,
      channelId: record.channelId,
      messageId: record.messageId,
      prize: record.prize,
      winnersCount: record.winnersCount,
      hostId: record.hostId,
      endsAt: record.endsAt,
      ended: record.ended,
      entries: record.entries,
      winners: record.winners,
      createdAt: record.createdAt,
    };
  }

  /**
   * Retrieves a giveaway by Discord message ID.
   */
  public async getGiveaway(messageId: string): Promise<GiveawayData | null> {
    const record = await this.client.giveaway.findUnique({
      where: { messageId },
    });
    if (!record) return null;

    return {
      id: record.id,
      guildId: record.guildId,
      channelId: record.channelId,
      messageId: record.messageId,
      prize: record.prize,
      winnersCount: record.winnersCount,
      hostId: record.hostId,
      endsAt: record.endsAt,
      ended: record.ended,
      entries: record.entries,
      winners: record.winners,
      createdAt: record.createdAt,
    };
  }

  /**
   * Enters a user into the giveaway if not already entered.
   */
  public async addEntry(
    messageId: string,
    userId: string,
  ): Promise<{ added: boolean; totalEntries: number }> {
    const current = await this.client.giveaway.findUnique({
      where: { messageId },
    });
    if (!current || current.ended) {
      return { added: false, totalEntries: current?.entries.length ?? 0 };
    }

    if (current.entries.includes(userId)) {
      return { added: false, totalEntries: current.entries.length };
    }

    const updated = await this.client.giveaway.update({
      where: { messageId },
      data: {
        entries: {
          push: userId,
        },
      },
    });

    return { added: true, totalEntries: updated.entries.length };
  }

  /**
   * Removes a user's entry from the giveaway.
   */
  public async removeEntry(
    messageId: string,
    userId: string,
  ): Promise<{ removed: boolean; totalEntries: number }> {
    const current = await this.client.giveaway.findUnique({
      where: { messageId },
    });
    if (!current || current.ended) {
      return { removed: false, totalEntries: current?.entries.length ?? 0 };
    }

    if (!current.entries.includes(userId)) {
      return { removed: false, totalEntries: current.entries.length };
    }

    const filtered = current.entries.filter((id) => id !== userId);
    const updated = await this.client.giveaway.update({
      where: { messageId },
      data: {
        entries: filtered,
      },
    });

    return { removed: true, totalEntries: updated.entries.length };
  }

  /**
   * Finalizes a giveaway by recording winners and setting ended = true.
   */
  public async endGiveaway(messageId: string, winners: string[]): Promise<GiveawayData> {
    const record = await this.client.giveaway.update({
      where: { messageId },
      data: {
        ended: true,
        winners,
      },
    });

    return {
      id: record.id,
      guildId: record.guildId,
      channelId: record.channelId,
      messageId: record.messageId,
      prize: record.prize,
      winnersCount: record.winnersCount,
      hostId: record.hostId,
      endsAt: record.endsAt,
      ended: record.ended,
      entries: record.entries,
      winners: record.winners,
      createdAt: record.createdAt,
    };
  }

  /**
   * Retrieves active, non-ended giveaways, optionally filtered by guild.
   */
  public async getActiveGiveaways(guildId?: string): Promise<GiveawayData[]> {
    const records = await this.client.giveaway.findMany({
      where: {
        ended: false,
        ...(guildId ? { guildId } : {}),
      },
      orderBy: { endsAt: 'asc' },
    });

    return records.map((record) => ({
      id: record.id,
      guildId: record.guildId,
      channelId: record.channelId,
      messageId: record.messageId,
      prize: record.prize,
      winnersCount: record.winnersCount,
      hostId: record.hostId,
      endsAt: record.endsAt,
      ended: record.ended,
      entries: record.entries,
      winners: record.winners,
      createdAt: record.createdAt,
    }));
  }
}
