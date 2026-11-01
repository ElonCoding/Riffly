import type { Guild, Message } from 'discord.js';
import { getPrismaClient } from '../../database/client.js';

export interface CommandResolution {
  isCommand: boolean;
  commandName: string;
  args: string[];
  isNoPrefix: boolean;
  prefixUsed: string;
}

export class PrefixService {
  private readonly client = getPrismaClient();

  // In-memory prefix cache: guildId -> prefix
  private readonly prefixCache = new Map<string, string>();

  // In-memory no-prefix cache: userId -> expiresAtMs (or null for permanent)
  private readonly noPrefixCache = new Map<string, number | null>();

  public async getPrefix(guildId: string): Promise<string> {
    const cached = this.prefixCache.get(guildId);
    if (cached) return cached;

    const record = await this.client.guildSettings.findUnique({
      where: { guildId },
      select: { prefix: true },
    });

    const prefix = record?.prefix ?? '!';
    this.prefixCache.set(guildId, prefix);
    return prefix;
  }

  public async setPrefix(guildId: string, prefix: string): Promise<string> {
    const trimmed = prefix.trim();
    await this.client.guildSettings.upsert({
      where: { guildId },
      update: { prefix: trimmed },
      create: { guildId, prefix: trimmed },
    });

    this.prefixCache.set(guildId, trimmed);
    return trimmed;
  }

  public async isNoPrefix(userId: string): Promise<boolean> {
    const now = Date.now();
    if (this.noPrefixCache.has(userId)) {
      const exp = this.noPrefixCache.get(userId);
      if (exp === null || (exp !== undefined && exp > now)) return true;
      this.noPrefixCache.delete(userId);
      return false;
    }

    const exemption = await this.client.noPrefixExemption.findUnique({
      where: { userId },
    });

    if (!exemption) return false;

    if (exemption.expiresAt && exemption.expiresAt.getTime() <= now) {
      await this.client.noPrefixExemption.delete({ where: { userId } }).catch(() => null);
      return false;
    }

    this.noPrefixCache.set(userId, exemption.expiresAt ? exemption.expiresAt.getTime() : null);
    return true;
  }

  public async grantNoPrefix(
    userId: string,
    grantedBy: string,
    durationDays?: number,
  ): Promise<void> {
    const expiresAt = durationDays ? new Date(Date.now() + durationDays * 86400 * 1000) : null;
    await this.client.noPrefixExemption.upsert({
      where: { userId },
      update: { expiresAt, grantedBy, grantedAt: new Date() },
      create: { userId, expiresAt, grantedBy },
    });

    this.noPrefixCache.set(userId, expiresAt ? expiresAt.getTime() : null);
  }

  public async revokeNoPrefix(userId: string): Promise<boolean> {
    const deleted = await this.client.noPrefixExemption.deleteMany({
      where: { userId },
    });
    this.noPrefixCache.delete(userId);
    return deleted.count > 0;
  }

  public async listNoPrefix() {
    return this.client.noPrefixExemption.findMany();
  }

  /**
   * Resolves whether an incoming chat message matches a bot command invocation:
   * 1. Matches guild custom prefix
   * 2. Matches fallback prefix '?'
   * 3. Matches mention `@Riffly `
   * 4. Matches no-prefix exemption for recognized command names
   */
  public async resolveCommand(
    message: Message,
    knownCommands: Set<string>,
    botId?: string,
  ): Promise<CommandResolution> {
    const content = message.content.trim();
    if (!content) {
      return { isCommand: false, commandName: '', args: [], isNoPrefix: false, prefixUsed: '' };
    }

    const guildId = message.guildId;
    const customPrefix = guildId ? await this.getPrefix(guildId) : '!';
    const mentionPrefix = botId ? `<@${botId}>` : '';
    const mentionNickPrefix = botId ? `<@!${botId}>` : '';

    // 1. Check custom prefix
    if (content.startsWith(customPrefix)) {
      const stripped = content.slice(customPrefix.length).trim();
      const parts = stripped.split(/\s+/);
      const commandName = parts[0]?.toLowerCase() ?? '';
      return {
        isCommand: true,
        commandName,
        args: parts.slice(1),
        isNoPrefix: false,
        prefixUsed: customPrefix,
      };
    }

    // 2. Check fallback prefix '?'
    if (content.startsWith('?') && customPrefix !== '?') {
      const stripped = content.slice(1).trim();
      const parts = stripped.split(/\s+/);
      const commandName = parts[0]?.toLowerCase() ?? '';
      return {
        isCommand: true,
        commandName,
        args: parts.slice(1),
        isNoPrefix: false,
        prefixUsed: '?',
      };
    }

    // 3. Check bot mention
    if (mentionPrefix && content.startsWith(mentionPrefix)) {
      const stripped = content.slice(mentionPrefix.length).trim();
      const parts = stripped.split(/\s+/);
      const commandName = parts[0]?.toLowerCase() ?? '';
      return {
        isCommand: true,
        commandName,
        args: parts.slice(1),
        isNoPrefix: false,
        prefixUsed: '@mention',
      };
    }
    if (mentionNickPrefix && content.startsWith(mentionNickPrefix)) {
      const stripped = content.slice(mentionNickPrefix.length).trim();
      const parts = stripped.split(/\s+/);
      const commandName = parts[0]?.toLowerCase() ?? '';
      return {
        isCommand: true,
        commandName,
        args: parts.slice(1),
        isNoPrefix: false,
        prefixUsed: '@mention',
      };
    }

    // 4. Check no-prefix exemption
    const hasExemption = await this.isNoPrefix(message.author.id);
    if (hasExemption) {
      const parts = content.split(/\s+/);
      const firstWord = parts[0]?.toLowerCase() ?? '';
      if (knownCommands.has(firstWord)) {
        return {
          isCommand: true,
          commandName: firstWord,
          args: parts.slice(1),
          isNoPrefix: true,
          prefixUsed: '',
        };
      }
    }

    return { isCommand: false, commandName: '', args: [], isNoPrefix: false, prefixUsed: '' };
  }

  // --- Templates ---
  public async saveTemplate(guild: Guild, name: string, creatorId: string): Promise<string> {
    const roles = Array.from(guild.roles.cache.values())
      .filter((r) => r.id !== guild.id)
      .map((r) => ({
        name: r.name,
        color: r.color,
        permissions: r.permissions.bitfield.toString(),
      }));

    const channels = Array.from(guild.channels.cache.values()).map((c) => ({
      name: c.name,
      type: c.type,
      parentId: c.parentId,
    }));

    const snapshot = {
      name: guild.name,
      roles,
      channels,
      createdAt: new Date().toISOString(),
    };

    await this.client.guildSettings.upsert({
      where: { guildId: guild.id },
      update: {},
      create: { guildId: guild.id },
    });

    const record = await this.client.serverTemplate.create({
      data: {
        guildId: guild.id,
        name: name.toLowerCase(),
        creatorId,
        data: snapshot,
      },
    });

    return record.id;
  }

  public async getTemplate(guildId: string, name: string) {
    return this.client.serverTemplate.findFirst({
      where: { guildId, name: name.toLowerCase() },
    });
  }

  public async listTemplates(guildId: string) {
    return this.client.serverTemplate.findMany({
      where: { guildId },
      select: { id: true, name: true, creatorId: true, createdAt: true },
    });
  }

  public async deleteTemplate(guildId: string, name: string): Promise<boolean> {
    const deleted = await this.client.serverTemplate.deleteMany({
      where: { guildId, name: name.toLowerCase() },
    });
    return deleted.count > 0;
  }
}
