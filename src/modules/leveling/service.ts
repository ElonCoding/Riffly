import { EmbedBuilder } from 'discord.js';
import type { GuildMember, TextChannel, User } from 'discord.js';
import type { ILevelRepository, UserLevelData } from '../../database/types.js';
import type { XpAwardResult } from './types.js';

/**
 * Calculates XP required to advance from a given level to the next.
 */
export function xpNeededForLevel(level: number): number {
  return 5 * level * level + 50 * level + 100;
}

/**
 * Calculates total cumulative level achieved for a given amount of lifetime XP.
 */
export function calculateLevelFromXp(totalXp: number): number {
  let level = 0;
  let remaining = totalXp;
  while (remaining >= xpNeededForLevel(level)) {
    remaining -= xpNeededForLevel(level);
    level += 1;
  }
  return level;
}

/**
 * Returns level progress details: current level, XP into current level, and XP needed for next level.
 */
export function getLevelProgress(totalXp: number): {
  level: number;
  currentLevelXp: number;
  nextLevelXpNeeded: number;
  percent: number;
} {
  let level = 0;
  let remaining = totalXp;
  while (remaining >= xpNeededForLevel(level)) {
    remaining -= xpNeededForLevel(level);
    level += 1;
  }
  const nextLevelXpNeeded = xpNeededForLevel(level);
  const percent = Math.min(100, Math.max(0, Math.round((remaining / nextLevelXpNeeded) * 100)));

  return {
    level,
    currentLevelXp: remaining,
    nextLevelXpNeeded,
    percent,
  };
}

export class LevelingService {
  private readonly cooldowns = new Map<string, number>();

  constructor(private readonly repository: ILevelRepository) {}

  /**
   * Evaluates message activity, enforces cooldowns, and awards random XP within configured bounds.
   */
  public async handleMessage(
    member: GuildMember,
    options: {
      minXp?: number;
      maxXp?: number;
      cooldownSeconds?: number;
      levelUpChannel?: TextChannel;
    } = {},
  ): Promise<XpAwardResult> {
    if (member.user.bot) {
      return { awarded: false, xpGained: 0, leveledUp: false, oldLevel: 0, newLevel: 0, totalXp: BigInt(0) };
    }

    const cooldownKey = `${member.guild.id}:${member.id}`;
    const now = Date.now();
    const cooldownMs = (options.cooldownSeconds ?? 60) * 1000;
    const lastAwarded = this.cooldowns.get(cooldownKey) ?? 0;

    if (now - lastAwarded < cooldownMs) {
      const current = await this.repository.getUserLevel(member.guild.id, member.id);
      return {
        awarded: false,
        xpGained: 0,
        leveledUp: false,
        oldLevel: current.level,
        newLevel: current.level,
        totalXp: current.xp,
      };
    }

    this.cooldowns.set(cooldownKey, now);

    const min = options.minXp ?? 15;
    const max = options.maxXp ?? 25;
    const xpGained = Math.floor(Math.random() * (max - min + 1)) + min;

    const result = await this.repository.addXp(
      member.guild.id,
      member.id,
      xpGained,
      calculateLevelFromXp,
    );

    if (result.leveledUp && options.levelUpChannel) {
      const embed = new EmbedBuilder()
        .setTitle('🎉 Level Up!')
        .setColor(0xf59e0b)
        .setDescription(
          `Congratulations <@${member.id}>! You reached **Level ${result.newLevel}**!`,
        )
        .setThumbnail(member.user.displayAvatarURL())
        .setTimestamp();

      await options.levelUpChannel.send({ embeds: [embed] }).catch(() => null);
    }

    return {
      awarded: true,
      xpGained,
      leveledUp: result.leveledUp,
      oldLevel: result.oldLevel,
      newLevel: result.newLevel,
      totalXp: result.data.xp,
    };
  }

  /**
   * Generates a rank card embed displaying level, total XP, and progress toward the next level.
   */
  public async getRankEmbed(guildId: string, user: User): Promise<EmbedBuilder> {
    const data = await this.repository.getUserLevel(guildId, user.id);
    const totalXp = Number(data.xp);
    const progress = getLevelProgress(totalXp);

    const barLength = 15;
    const filled = Math.round((progress.percent / 100) * barLength);
    const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);

    return new EmbedBuilder()
      .setTitle(`🏆 Rank Card — ${user.username}`)
      .setColor(0x6366f1)
      .setThumbnail(user.displayAvatarURL())
      .addFields(
        { name: 'Level', value: `\`${progress.level}\``, inline: true },
        { name: 'Total XP', value: `\`${totalXp.toLocaleString()}\``, inline: true },
        { name: 'Messages Sent', value: `\`${data.messagesCount.toLocaleString()}\``, inline: true },
        {
          name: 'Progress to Next Level',
          value: `\`${bar}\` ${progress.percent}%\n${progress.currentLevelXp} / ${progress.nextLevelXpNeeded} XP`,
          inline: false,
        },
      )
      .setTimestamp();
  }

  /**
   * Generates a server leaderboard embed displaying top users by XP.
   */
  public async getLeaderboardEmbed(
    guildId: string,
    guildName: string,
    limit = 10,
    offset = 0,
  ): Promise<EmbedBuilder> {
    const leaderboard = await this.repository.getLeaderboard(guildId, limit, offset);

    const embed = new EmbedBuilder()
      .setTitle(`🏅 Level Leaderboard — ${guildName}`)
      .setColor(0xf59e0b)
      .setTimestamp();

    if (leaderboard.length === 0) {
      embed.setDescription('*No XP activity recorded yet on this server.*');
      return embed;
    }

    const medals = ['🥇', '🥈', '🥉'];
    const lines = leaderboard.map((entry, index) => {
      const rank = offset + index + 1;
      const rankPrefix = rank <= 3 ? medals[rank - 1] : `**#${rank}**`;
      return `${rankPrefix} <@${entry.userId}> — **Level ${entry.level}** (\`${Number(entry.xp).toLocaleString()} XP\`) • ${entry.messagesCount} msgs`;
    });

    embed.setDescription(lines.join('\n'));
    return embed;
  }

  /**
   * Sets user level and XP directly.
   */
  public async setLevel(
    guildId: string,
    userId: string,
    level: number,
    xp: number,
  ): Promise<UserLevelData> {
    return this.repository.setUserLevel(guildId, userId, level, BigInt(xp));
  }

  /**
   * Resets leveling statistics for a specific user or the entire guild.
   */
  public async resetStats(
    guildId: string,
    options: {
      userId?: string | undefined;
      field?: 'all' | 'xp' | 'messages' | 'voice' | undefined;
    } = {},
  ): Promise<void> {
    const field = options.field ?? 'all';
    if (options.userId) {
      if (typeof this.repository.resetUser === 'function') {
        await this.repository.resetUser(guildId, options.userId, field);
      }
    } else {
      if (typeof this.repository.resetGuild === 'function') {
        await this.repository.resetGuild(guildId, field);
      }
    }
  }

  /**
   * Deploys an automated live leaderboard embed to a target channel.
   */
  public async setupLiveLeaderboard(
    channel: TextChannel,
    type = 'xp',
    timeframe = 'alltime',
  ): Promise<{ id: string; messageId: string }> {
    const embed = await this.getLeaderboardEmbed(channel.guild.id, channel.guild.name, 10, 0);
    embed.setFooter({ text: `Riffly Live Leaderboard • Type: ${type} • Updates every 15s` });

    const msg = await channel.send({ embeds: [embed] });

    let id = `lb_${Date.now()}`;
    if (typeof this.repository.createLiveLeaderboard === 'function') {
      const record = await this.repository.createLiveLeaderboard(
        channel.guild.id,
        channel.id,
        msg.id,
        type,
        timeframe,
      );
      id = record.id;
    }

    return { id, messageId: msg.id };
  }

  /**
   * Lists active live leaderboards.
   */
  public async listLiveLeaderboards(guildId: string) {
    if (typeof this.repository.listLiveLeaderboards === 'function') {
      return this.repository.listLiveLeaderboards(guildId);
    }
    return [];
  }

  /**
   * Removes a live leaderboard.
   */
  public async removeLiveLeaderboard(guildId: string, id: string): Promise<boolean> {
    if (typeof this.repository.removeLiveLeaderboard === 'function') {
      return this.repository.removeLiveLeaderboard(guildId, id);
    }
    return false;
  }
}

