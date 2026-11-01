import { ChannelType, type Guild, type GuildMember, type TextChannel } from 'discord.js';
import type {
  PrismaSecurityRepository,
  AntiNukeConfig,
  AntiRaidConfig,
  AutoModConfig,
} from '../../database/repositories/security-repository.js';

export interface SecurityViolationEvent {
  guildId: string;
  executorId: string;
  type: 'ban' | 'kick' | 'channel_delete' | 'role_delete';
  timestamp: number;
}

export class SecurityService {
  private readonly repository: PrismaSecurityRepository;

  // Track recent moderator actions: key = `${guildId}:${executorId}:${type}` -> timestamps[]
  private readonly nukeTracker = new Map<string, number[]>();

  // Track recent member joins: key = guildId -> Array<{ userId: string, joinedAt: number }>
  private readonly joinTracker = new Map<string, Array<{ userId: string; joinedAt: number }>>();

  constructor(repository: PrismaSecurityRepository) {
    this.repository = repository;
  }

  // --- ANTI-NUKE ---
  public async getAntiNuke(guildId: string): Promise<AntiNukeConfig> {
    return this.repository.getAntiNuke(guildId);
  }

  public async setAntiNuke(
    guildId: string,
    data: Partial<AntiNukeConfig>,
  ): Promise<AntiNukeConfig> {
    return this.repository.setAntiNuke(guildId, data);
  }

  public async addNukeWhitelist(guildId: string, userId: string): Promise<string[]> {
    const current = await this.repository.getAntiNuke(guildId);
    if (!current.whitelist.includes(userId)) {
      const updated = [...current.whitelist, userId];
      await this.repository.setAntiNuke(guildId, { whitelist: updated });
      return updated;
    }
    return current.whitelist;
  }

  public async removeNukeWhitelist(guildId: string, userId: string): Promise<string[]> {
    const current = await this.repository.getAntiNuke(guildId);
    const updated = current.whitelist.filter((id) => id !== userId);
    await this.repository.setAntiNuke(guildId, { whitelist: updated });
    return updated;
  }

  /**
   * Evaluates an administrative action against anti-nuke thresholds.
   * Returns true if anti-nuke triggered and punishment was executed.
   */
  public async handleAuditAction(
    guild: Guild,
    executor: GuildMember,
    actionType: 'ban' | 'kick' | 'channel_delete' | 'role_delete',
  ): Promise<boolean> {
    // Never punish server owner or bot itself
    if (executor.id === guild.ownerId || executor.id === guild.client.user?.id) {
      return false;
    }

    const config = await this.repository.getAntiNuke(guild.id);
    if (!config.enabled) return false;

    // Check whitelist
    if (config.whitelist.includes(executor.id)) return false;

    const now = Date.now();
    const windowMs = 10000; // 10 seconds sliding window
    const key = `${guild.id}:${executor.id}:${actionType}`;
    const recent = (this.nukeTracker.get(key) ?? []).filter((t) => now - t < windowMs);
    recent.push(now);
    this.nukeTracker.set(key, recent);

    let threshold = 5;
    if (actionType === 'ban') threshold = config.banThreshold;
    else if (actionType === 'kick') threshold = config.kickThreshold;
    else if (actionType === 'channel_delete') threshold = config.channelDeleteThreshold;

    if (recent.length >= threshold) {
      // Threshold exceeded: execute sanction
      try {
        if (config.action === 'ban' && executor.bannable) {
          await guild.members.ban(executor.id, {
            reason: `Riffly Anti-Nuke: Exceeded ${actionType} threshold (${recent.length}/${threshold})`,
          });
        } else if (config.action === 'kick' && executor.kickable) {
          await executor.kick(
            `Riffly Anti-Nuke: Exceeded ${actionType} threshold (${recent.length}/${threshold})`,
          );
        } else if (config.action === 'strip_roles') {
          const removableRoles = executor.roles.cache.filter(
            (r) => r.id !== guild.id && !r.managed,
          );
          await executor.roles.remove(removableRoles, 'Riffly Anti-Nuke: Role stripping sanction');
        }
        this.nukeTracker.delete(key);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  // --- ANTI-RAID ---
  public async getAntiRaid(guildId: string): Promise<AntiRaidConfig> {
    return this.repository.getAntiRaid(guildId);
  }

  public async setAntiRaid(
    guildId: string,
    data: Partial<AntiRaidConfig>,
  ): Promise<AntiRaidConfig> {
    return this.repository.setAntiRaid(guildId, data);
  }

  /**
   * Tracks member joins and triggers anti-raid lockdown / mass action if threshold reached.
   */
  public async handleMemberJoin(member: GuildMember): Promise<boolean> {
    const config = await this.repository.getAntiRaid(member.guild.id);
    if (!config.enabled) return false;

    const now = Date.now();
    const windowMs = config.windowSeconds * 1000;
    const guildKey = member.guild.id;

    const joins = (this.joinTracker.get(guildKey) ?? []).filter((j) => now - j.joinedAt < windowMs);
    joins.push({ userId: member.id, joinedAt: now });
    this.joinTracker.set(guildKey, joins);

    if (joins.length >= config.joinThreshold) {
      // Raid detected! Apply action to recent joiners
      for (const j of joins) {
        try {
          const target = member.guild.members.cache.get(j.userId);
          if (target && !target.user.bot) {
            if (config.action === 'kick' && target.kickable) {
              await target.kick('Riffly Anti-Raid: Mass join triggered');
            } else if (config.action === 'ban' && target.bannable) {
              await member.guild.members.ban(target.id, {
                reason: 'Riffly Anti-Raid: Mass join triggered',
              });
            } else if (config.action === 'timeout') {
              await target.timeout(3600000, 'Riffly Anti-Raid: Mass join triggered');
            }
          }
        } catch {
          // ignore individual member failure
        }
      }

      if (config.autoLockdown) {
        await this.lockdown(member.guild, 'Riffly Anti-Raid: Automated server lockdown');
      }

      return true;
    }
    return false;
  }

  public async lockdown(guild: Guild, reason?: string): Promise<number> {
    let count = 0;
    const channels = Array.from(guild.channels.cache.values()).filter(
      (c): c is TextChannel => c.type === ChannelType.GuildText,
    );

    for (const channel of channels) {
      try {
        await channel.permissionOverwrites.edit(
          guild.roles.everyone,
          {
            SendMessages: false,
          },
          { reason: reason ?? 'Riffly Anti-Raid Server Lockdown' },
        );
        count++;
      } catch {
        // continue
      }
    }
    return count;
  }

  public async unlockdown(guild: Guild): Promise<number> {
    let count = 0;
    const channels = Array.from(guild.channels.cache.values()).filter(
      (c): c is TextChannel => c.type === ChannelType.GuildText,
    );

    for (const channel of channels) {
      try {
        await channel.permissionOverwrites.edit(
          guild.roles.everyone,
          {
            SendMessages: null,
          },
          { reason: 'Riffly Anti-Raid Lockdown lifted' },
        );
        count++;
      } catch {
        // continue
      }
    }
    return count;
  }

  // --- AUTOMOD ---
  public async getAutoMod(guildId: string): Promise<AutoModConfig> {
    return this.repository.getAutoMod(guildId);
  }

  public async setAutoMod(guildId: string, data: Partial<AutoModConfig>): Promise<AutoModConfig> {
    return this.repository.setAutoMod(guildId, data);
  }

  public async addBannedWord(guildId: string, word: string): Promise<string[]> {
    const current = await this.repository.getAutoMod(guildId);
    const trimmed = word.trim().toLowerCase();
    if (!current.bannedWords.includes(trimmed)) {
      const updated = [...current.bannedWords, trimmed];
      await this.repository.setAutoMod(guildId, { bannedWords: updated });
      return updated;
    }
    return current.bannedWords;
  }

  public async removeBannedWord(guildId: string, word: string): Promise<string[]> {
    const current = await this.repository.getAutoMod(guildId);
    const trimmed = word.trim().toLowerCase();
    const updated = current.bannedWords.filter((w) => w !== trimmed);
    await this.repository.setAutoMod(guildId, { bannedWords: updated });
    return updated;
  }

  public async addAutoModWhitelist(
    guildId: string,
    targetId: string,
    type: 'channel' | 'role',
  ): Promise<{ channels: string[]; roles: string[] }> {
    const current = await this.repository.getAutoMod(guildId);
    if (type === 'channel' && !current.whitelistedChannels.includes(targetId)) {
      const updated = [...current.whitelistedChannels, targetId];
      await this.repository.setAutoMod(guildId, { whitelistedChannels: updated });
      return { channels: updated, roles: current.whitelistedRoles };
    }
    if (type === 'role' && !current.whitelistedRoles.includes(targetId)) {
      const updated = [...current.whitelistedRoles, targetId];
      await this.repository.setAutoMod(guildId, { whitelistedRoles: updated });
      return { channels: current.whitelistedChannels, roles: updated };
    }
    return { channels: current.whitelistedChannels, roles: current.whitelistedRoles };
  }

  public async removeAutoModWhitelist(
    guildId: string,
    targetId: string,
    type: 'channel' | 'role',
  ): Promise<{ channels: string[]; roles: string[] }> {
    const current = await this.repository.getAutoMod(guildId);
    if (type === 'channel') {
      const updated = current.whitelistedChannels.filter((id) => id !== targetId);
      await this.repository.setAutoMod(guildId, { whitelistedChannels: updated });
      return { channels: updated, roles: current.whitelistedRoles };
    }
    const updated = current.whitelistedRoles.filter((id) => id !== targetId);
    await this.repository.setAutoMod(guildId, { whitelistedRoles: updated });
    return { channels: current.whitelistedChannels, roles: updated };
  }
}
