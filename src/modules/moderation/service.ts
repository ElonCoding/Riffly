import type {
  Guild,
  GuildMember,
  TextChannel,
  User,
} from 'discord.js';
import { PermissionFlagsBits } from 'discord.js';
import type { IModerationRepository, ModerationCaseData } from '../../database/types.js';
import type { ModerationResult } from './types.js';

export class ModerationHierarchyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModerationHierarchyError';
  }
}

/**
 * Core moderation service orchestrating guild member sanctions, permission checks,
 * and immutable case logging.
 */
export class ModerationService {
  constructor(private readonly repository: IModerationRepository) {}

  /**
   * Validates role hierarchy between the moderator, bot member, and target.
   */
  public checkHierarchy(
    moderator: GuildMember,
    target: GuildMember,
    botMember?: GuildMember,
  ): void {
    if (moderator.id === target.id) {
      throw new ModerationHierarchyError('You cannot moderate yourself.');
    }

    if (target.guild.ownerId === target.id) {
      throw new ModerationHierarchyError('Cannot moderate the server owner.');
    }

    if (moderator.guild.ownerId !== moderator.id) {
      if (moderator.roles.highest.position <= target.roles.highest.position) {
        throw new ModerationHierarchyError(
          'Target member has an equal or higher role than your highest role.',
        );
      }
    }

    if (botMember && botMember.roles.highest.position <= target.roles.highest.position) {
      throw new ModerationHierarchyError(
        'Target member has an equal or higher role than Riffly bot.',
      );
    }
  }

  /**
   * Bans a user from the guild and creates a moderation case.
   */
  public async ban(
    guild: Guild,
    moderator: GuildMember,
    target: User | GuildMember,
    reason?: string,
    deleteMessageDays = 0,
  ): Promise<ModerationResult> {
    const targetId = target.id;
    const targetMember = 'roles' in target ? target : await guild.members.fetch(targetId).catch(() => null);

    if (targetMember) {
      this.checkHierarchy(moderator, targetMember, guild.members.me ?? undefined);
    }

    const deleteMessageSeconds = Math.min(7, Math.max(0, deleteMessageDays)) * 86400;

    await guild.members.ban(targetId, {
      reason: reason ?? `Banned by ${moderator.user.tag}`,
      deleteMessageSeconds,
    });

    const modCase = await this.repository.createCase({
      guildId: guild.id,
      targetId,
      moderatorId: moderator.id,
      action: 'ban',
      reason: reason ?? null,
    });

    return {
      success: true,
      action: 'ban',
      caseNumber: modCase.caseNumber,
      message: `Banned <@${targetId}> (Case #${modCase.caseNumber}).`,
    };
  }

  /**
   * Unbans a previously banned user from the guild.
   */
  public async unban(
    guild: Guild,
    moderator: GuildMember,
    targetId: string,
    reason?: string,
  ): Promise<ModerationResult> {
    await guild.members.unban(targetId, reason ?? `Unbanned by ${moderator.user.tag}`);

    const modCase = await this.repository.createCase({
      guildId: guild.id,
      targetId,
      moderatorId: moderator.id,
      action: 'unban',
      reason: reason ?? null,
    });

    return {
      success: true,
      action: 'unban',
      caseNumber: modCase.caseNumber,
      message: `Unbanned <@${targetId}> (Case #${modCase.caseNumber}).`,
    };
  }

  /**
   * Kicks a member from the guild.
   */
  public async kick(
    guild: Guild,
    moderator: GuildMember,
    targetMember: GuildMember,
    reason?: string,
  ): Promise<ModerationResult> {
    this.checkHierarchy(moderator, targetMember, guild.members.me ?? undefined);

    await targetMember.kick(reason ?? `Kicked by ${moderator.user.tag}`);

    const modCase = await this.repository.createCase({
      guildId: guild.id,
      targetId: targetMember.id,
      moderatorId: moderator.id,
      action: 'kick',
      reason: reason ?? null,
    });

    return {
      success: true,
      action: 'kick',
      caseNumber: modCase.caseNumber,
      message: `Kicked <@${targetMember.id}> (Case #${modCase.caseNumber}).`,
    };
  }

  /**
   * Times out a member for a specified duration in milliseconds.
   */
  public async timeout(
    guild: Guild,
    moderator: GuildMember,
    targetMember: GuildMember,
    durationMs: number,
    reason?: string,
  ): Promise<ModerationResult> {
    this.checkHierarchy(moderator, targetMember, guild.members.me ?? undefined);

    const clampedDuration = Math.min(28 * 86400 * 1000, Math.max(1000, durationMs));
    await targetMember.timeout(clampedDuration, reason ?? `Timed out by ${moderator.user.tag}`);

    const modCase = await this.repository.createCase({
      guildId: guild.id,
      targetId: targetMember.id,
      moderatorId: moderator.id,
      action: 'timeout',
      reason: reason ?? null,
      durationMs: BigInt(clampedDuration),
    });

    return {
      success: true,
      action: 'timeout',
      caseNumber: modCase.caseNumber,
      message: `Timed out <@${targetMember.id}> for ${Math.round(clampedDuration / 1000)}s (Case #${modCase.caseNumber}).`,
    };
  }

  /**
   * Registers a formal warning against a user.
   */
  public async warn(
    guild: Guild,
    moderator: GuildMember,
    target: User | GuildMember,
    reason: string,
  ): Promise<ModerationResult> {
    const modCase = await this.repository.createCase({
      guildId: guild.id,
      targetId: target.id,
      moderatorId: moderator.id,
      action: 'warn',
      reason,
    });

    return {
      success: true,
      action: 'warn',
      caseNumber: modCase.caseNumber,
      message: `Warned <@${target.id}> (Case #${modCase.caseNumber}): ${reason}`,
    };
  }

  /**
   * Softbans a member: bans to delete recent messages, then unbans immediately.
   */
  public async softban(
    guild: Guild,
    moderator: GuildMember,
    targetMember: GuildMember,
    reason?: string,
    deleteMessageDays = 1,
  ): Promise<ModerationResult> {
    this.checkHierarchy(moderator, targetMember, guild.members.me ?? undefined);

    const targetId = targetMember.id;
    const deleteMessageSeconds = Math.min(7, Math.max(1, deleteMessageDays)) * 86400;

    await guild.members.ban(targetId, {
      reason: `Softban: ${reason ?? 'No reason provided'}`,
      deleteMessageSeconds,
    });

    await guild.members.unban(targetId, 'Softban complete (automatic unban)');

    const modCase = await this.repository.createCase({
      guildId: guild.id,
      targetId,
      moderatorId: moderator.id,
      action: 'softban',
      reason: reason ?? null,
    });

    return {
      success: true,
      action: 'softban',
      caseNumber: modCase.caseNumber,
      message: `Softbanned <@${targetId}> (Case #${modCase.caseNumber}).`,
    };
  }

  /**
   * Purges up to 100 messages from a text channel.
   */
  public async purge(
    channel: TextChannel,
    _moderator: GuildMember,
    count: number,
  ): Promise<{ deletedCount: number }> {
    const clampedCount = Math.min(100, Math.max(1, count));
    const deleted = await channel.bulkDelete(clampedCount, true);
    return { deletedCount: deleted.size };
  }

  /**
   * Sets channel slowmode in seconds.
   */
  public async setSlowmode(
    channel: TextChannel,
    moderator: GuildMember,
    seconds: number,
  ): Promise<void> {
    const clamped = Math.min(21600, Math.max(0, seconds));
    await channel.setRateLimitPerUser(clamped, `Slowmode updated by ${moderator.user.tag}`);
  }

  /**
   * Locks or unlocks a channel by adjusting @everyone permissions.
   */
  public async setChannelLock(
    channel: TextChannel,
    moderator: GuildMember,
    lock: boolean,
  ): Promise<void> {
    const everyoneRole = channel.guild.roles.everyone;
    await channel.permissionOverwrites.edit(
      everyoneRole,
      {
        [PermissionFlagsBits.SendMessages.toString()]: !lock,
      },
      {
        reason: `${lock ? 'Locked' : 'Unlocked'} by ${moderator.user.tag}`,
      },
    );
  }

  /**
   * Fetches user case history.
   */
  public async getHistory(guildId: string, targetId: string): Promise<ModerationCaseData[]> {
    return this.repository.getCasesForTarget(guildId, targetId);
  }
}
