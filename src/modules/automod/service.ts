import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import type { Message, TextChannel } from 'discord.js';
import type { AutoModCheckResult, AutoModRule, AutoModSettings } from './types.js';

const DISCORD_INVITE_REGEX =
  /(?:https?:\/\/)?(?:www\.)?(?:discord\.(?:gg|io|me|li)|discord(?:app)?\.com\/invite)\/([a-zA-Z0-9-]+)/i;
const URL_REGEX = /https?:\/\/[^\s]+/i;

/**
 * Core enforcement engine for PatternGuard / AutoMod security filters.
 */
export class AutoModService {
  /**
   * Sliding window cache tracking user message timestamps for anti-spam rate limiting.
   * Key: `${guildId}:${userId}` -> timestamps (ms)
   */
  private readonly rateLimits = new Map<string, number[]>();

  /**
   * Evaluates an incoming message against active server automod policies.
   */
  public async evaluateMessage(
    message: Message,
    settings: AutoModSettings = {},
  ): Promise<AutoModCheckResult> {
    if (!message.guild || !message.member || message.author.bot) {
      return { triggered: false };
    }

    if (settings.enabled === false) {
      return { triggered: false };
    }

    // Bypass administrators and server managers
    if (
      message.member.permissions.has(PermissionFlagsBits.Administrator) ||
      message.member.permissions.has(PermissionFlagsBits.ManageGuild)
    ) {
      return { triggered: false };
    }

    // Check ignored channels
    if (settings.ignoredChannels?.includes(message.channel.id)) {
      return { triggered: false };
    }

    // Check ignored roles
    if (
      settings.ignoredRoles &&
      message.member.roles.cache.some((role) => settings.ignoredRoles?.includes(role.id))
    ) {
      return { triggered: false };
    }

    const content = message.content ?? '';

    // 1. Anti-Invite Filter
    if (settings.antiInvite && DISCORD_INVITE_REGEX.test(content)) {
      return this.handleViolation(message, 'anti-invite', 'Discord invite links are not permitted.', settings);
    }

    // 2. Anti-Link Filter (Generic URLs)
    if (settings.antiLink && URL_REGEX.test(content)) {
      return this.handleViolation(message, 'anti-link', 'External links are not permitted.', settings);
    }

    // 3. Banned Words Filter
    if (settings.bannedWords && settings.bannedWords.length > 0) {
      const lower = content.toLowerCase();
      const matched = settings.bannedWords.find((word) =>
        lower.includes(word.toLowerCase().trim()),
      );
      if (matched) {
        return this.handleViolation(
          message,
          'banned-words',
          `Message contains prohibited keyword: "${matched}"`,
          settings,
        );
      }
    }

    // 4. Mention Spam Filter
    const maxMentions = settings.maxMentions ?? 5;
    const totalMentions = message.mentions.users.size + message.mentions.roles.size;
    if (settings.antiMentionSpam && totalMentions > maxMentions) {
      return this.handleViolation(
        message,
        'mention-spam',
        `Excessive mentions (${totalMentions} > limit of ${maxMentions})`,
        settings,
      );
    }

    // 5. Anti-Caps Filter
    const capsThreshold = settings.capsPercentage ?? 70;
    if (settings.antiCaps && content.length >= 8) {
      const letters = content.replace(/[^a-zA-Z]/g, '');
      if (letters.length >= 8) {
        const uppers = letters.replace(/[^A-Z]/g, '').length;
        const percent = Math.round((uppers / letters.length) * 100);
        if (percent >= capsThreshold) {
          return this.handleViolation(
            message,
            'anti-caps',
            `Excessive capital letters (${percent}% caps > threshold of ${capsThreshold}%)`,
            settings,
          );
        }
      }
    }

    // 6. Anti-Spam Rate Limit
    if (settings.antiSpam) {
      const isSpamming = this.checkRateLimit(
        message.guild.id,
        message.author.id,
        settings.spamMessageThreshold ?? 5,
        settings.spamTimeWindowSeconds ?? 5,
      );
      if (isSpamming) {
        return this.handleViolation(
          message,
          'anti-spam',
          'Sending messages too quickly (rate limit exceeded)',
          settings,
        );
      }
    }

    return { triggered: false };
  }

  /**
   * Tracks user message timestamps and returns true if rate limit threshold is exceeded.
   */
  private checkRateLimit(
    guildId: string,
    userId: string,
    threshold: number,
    windowSeconds: number,
  ): boolean {
    const key = `${guildId}:${userId}`;
    const now = Date.now();
    const windowMs = windowSeconds * 1000;

    const timestamps = this.rateLimits.get(key) ?? [];
    const valid = timestamps.filter((time) => now - time < windowMs);
    valid.push(now);
    this.rateLimits.set(key, valid);

    return valid.length >= threshold;
  }

  /**
   * Executes sanctions (message deletion, member timeout, user warning) and sends notifications.
   */
  private async handleViolation(
    message: Message,
    rule: AutoModRule,
    reason: string,
    settings: AutoModSettings,
  ): Promise<AutoModCheckResult> {
    const action = settings.action ?? 'delete';

    // Delete offending message
    await message.delete().catch(() => null);

    // Apply timeout if configured
    if (action === 'timeout' && message.member) {
      const durationSeconds = settings.timeoutDurationSeconds ?? 60;
      await message.member
        .timeout(durationSeconds * 1000, `Riffly AutoMod: ${reason}`)
        .catch(() => null);
    }

    // Send ephemeral warning / short-lived feedback
    if ('send' in message.channel && typeof message.channel.send === 'function') {
      const warnMsg = await message.channel
        .send({
          content: `⚠️ <@${message.author.id}>, your message was removed by **Riffly AutoMod** (${reason}).`,
        })
        .catch(() => null);

      if (warnMsg) {
        setTimeout(() => {
          warnMsg.delete().catch(() => null);
        }, 6000);
      }
    }

    // Log violation to designated audit channel if configured
    if (settings.logChannelId && message.guild) {
      const channel = await message.guild.channels.fetch(settings.logChannelId).catch(() => null);
      if (channel && 'send' in channel && typeof (channel as TextChannel).send === 'function') {
        const embed = new EmbedBuilder()
          .setTitle('🛡️ AutoMod Violation')
          .setColor(0xef4444)
          .setDescription(`**User:** <@${message.author.id}> (\`${message.author.id}\`)\n**Rule:** \`${rule}\`\n**Action:** \`${action}\`\n**Reason:** ${reason}`)
          .addFields({
            name: 'Message Content',
            value: message.content ? `\`\`\`${message.content.slice(0, 1000)}\`\`\`` : '*No text content*',
          })
          .setTimestamp();

        await (channel as TextChannel).send({ embeds: [embed] }).catch(() => null);
      }
    }

    return {
      triggered: true,
      rule,
      reason,
      actionTaken: action,
    };
  }
}
