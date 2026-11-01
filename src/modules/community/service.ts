import {
  type ColorResolvable,
  type Guild,
  type GuildMember,
  type Message,
  type MessageReaction,
  type User,
} from 'discord.js';
import {
  PrismaCommunityRepository,
  type AutoResponderItem,
  type AutoRoleItem,
  type InviteStats,
  type ReactionRoleItem,
  type SocialAlertItem,
  type TimerItem,
  type VanityRoleItem,
} from '../../database/repositories/community-repository.js';

export class CommunityService {
  private readonly repository: PrismaCommunityRepository;

  constructor(repository?: PrismaCommunityRepository) {
    this.repository = repository ?? new PrismaCommunityRepository();
  }

  // --- AutoRoles ---
  public async addAutoRole(guildId: string, roleId: string, targetType = 'all'): Promise<void> {
    await this.repository.addAutoRole(guildId, roleId, targetType);
  }

  public async removeAutoRole(guildId: string, roleId: string): Promise<boolean> {
    return this.repository.removeAutoRole(guildId, roleId);
  }

  public async listAutoRoles(guildId: string): Promise<AutoRoleItem[]> {
    return this.repository.listAutoRoles(guildId);
  }

  public async handleMemberJoin(member: GuildMember): Promise<void> {
    const roles = await this.repository.listAutoRoles(member.guild.id);
    for (const r of roles) {
      if (
        r.targetType === 'all' ||
        (r.targetType === 'bots' && member.user.bot) ||
        (r.targetType === 'humans' && !member.user.bot)
      ) {
        const role = member.guild.roles.cache.get(r.roleId);
        if (role) {
          await member.roles.add(role, 'Riffly AutoRole on join').catch(() => null);
        }
      }
    }
  }

  // --- Reaction Roles ---
  public async addReactionRole(
    guildId: string,
    channelId: string,
    messageId: string,
    emoji: string,
    roleId: string,
  ): Promise<void> {
    await this.repository.addReactionRole(guildId, channelId, messageId, emoji, roleId);
  }

  public async removeReactionRole(guildId: string, messageId: string, emoji: string): Promise<boolean> {
    return this.repository.removeReactionRole(guildId, messageId, emoji);
  }

  public async deleteReactionRole(guildId: string, messageId: string): Promise<boolean> {
    return this.repository.deleteReactionRoleByMessage(guildId, messageId);
  }

  public async listReactionRoles(guildId: string): Promise<ReactionRoleItem[]> {
    return this.repository.listReactionRoles(guildId);
  }

  public async handleReaction(reaction: MessageReaction, user: User, added: boolean): Promise<void> {
    if (user.bot || !reaction.message.guild) return;
    const guild = reaction.message.guild;
    const emojiStr = reaction.emoji.id ? `<:${reaction.emoji.name}:${reaction.emoji.id}>` : (reaction.emoji.name ?? '');

    const all = await this.repository.listReactionRoles(guild.id);
    const match = all.find(
      (rr) => rr.messageId === reaction.message.id && (rr.emoji === emojiStr || rr.emoji === reaction.emoji.name),
    );

    if (match) {
      const member = await guild.members.fetch(user.id).catch(() => null);
      if (!member) return;
      const role = guild.roles.cache.get(match.roleId);
      if (role) {
        if (added) {
          await member.roles.add(role, 'Riffly Reaction Role').catch(() => null);
        } else {
          await member.roles.remove(role, 'Riffly Reaction Role removal').catch(() => null);
        }
      }
    }
  }

  // --- Vanity Roles ---
  public async addVanityRole(guildId: string, keyword: string, roleId: string): Promise<void> {
    await this.repository.addVanityRole(guildId, keyword, roleId);
  }

  public async removeVanityRole(guildId: string, keyword: string): Promise<boolean> {
    return this.repository.removeVanityRole(guildId, keyword);
  }

  public async listVanityRoles(guildId: string): Promise<VanityRoleItem[]> {
    return this.repository.listVanityRoles(guildId);
  }

  // --- Invites ---
  public async getInvites(guildId: string, userId: string): Promise<InviteStats> {
    return this.repository.getInvites(guildId, userId);
  }

  // --- Timers ---
  public async createTimer(
    guildId: string,
    channelId: string,
    name: string,
    durationSeconds: number,
    creatorId: string,
  ): Promise<TimerItem> {
    return this.repository.createTimer(guildId, channelId, name, durationSeconds, creatorId);
  }

  public async listTimers(guildId: string): Promise<TimerItem[]> {
    return this.repository.listTimers(guildId);
  }

  public async cancelTimer(guildId: string, name: string): Promise<boolean> {
    return this.repository.cancelTimer(guildId, name);
  }

  public async pauseTimer(guildId: string, name: string): Promise<boolean> {
    return this.repository.pauseTimer(guildId, name);
  }

  public async resumeTimer(guildId: string, name: string): Promise<boolean> {
    return this.repository.resumeTimer(guildId, name);
  }

  // --- Clownboard ---
  public async setupClownboard(guildId: string, channelId: string, threshold = 3) {
    return this.repository.setupClownboard(guildId, channelId, threshold);
  }

  public async disableClownboard(guildId: string) {
    return this.repository.disableClownboard(guildId);
  }

  public async getClownboard(guildId: string) {
    return this.repository.getClownboard(guildId);
  }

  // --- Counting Channel ---
  public async setupCounting(guildId: string, channelId: string) {
    return this.repository.setupCounting(guildId, channelId);
  }

  public async resetCounting(guildId: string) {
    return this.repository.resetCounting(guildId);
  }

  public async disableCounting(guildId: string) {
    return this.repository.disableCounting(guildId);
  }

  public async getCounting(guildId: string) {
    return this.repository.getCounting(guildId);
  }

  public async handleCountingMessage(message: Message): Promise<boolean> {
    if (!message.guild || message.author.bot) return false;
    const cfg = await this.repository.getCounting(message.guild.id);
    if (!cfg || cfg.channelId !== message.channel.id) return false;

    const num = parseInt(message.content.trim(), 10);
    const expected = cfg.currentNumber + 1;

    // Check if user is trying to count twice in a row or wrong number
    if (isNaN(num) || num !== expected || cfg.lastUserId === message.author.id) {
      await message.react('❌').catch(() => null);
      await this.repository.resetCounting(message.guild.id);
      if ('send' in message.channel && typeof message.channel.send === 'function') {
        await message.channel.send(
          `💥 <@${message.author.id}> ruined the streak at **${cfg.currentNumber}**! Count starts back at **1**.`,
        );
      }
      return false;
    }

    // Success
    await message.react('✅').catch(() => null);
    await this.repository.updateCount(message.guild.id, expected, message.author.id);
    return true;
  }

  // --- AutoResponder ---
  public async addAutoResponder(
    guildId: string,
    trigger: string,
    reply: string,
    matchType = 'exact',
  ): Promise<void> {
    await this.repository.addAutoResponder(guildId, trigger, reply, matchType);
  }

  public async removeAutoResponder(guildId: string, trigger: string): Promise<boolean> {
    return this.repository.removeAutoResponder(guildId, trigger);
  }

  public async clearAutoResponders(guildId: string): Promise<number> {
    return this.repository.clearAutoResponders(guildId);
  }

  public async listAutoResponders(guildId: string): Promise<AutoResponderItem[]> {
    return this.repository.listAutoResponders(guildId);
  }

  public async evaluateAutoResponder(guildId: string, content: string): Promise<string | null> {
    const list = await this.repository.listAutoResponders(guildId);
    const lower = content.toLowerCase().trim();

    for (const ar of list) {
      if (ar.matchType === 'exact' && lower === ar.trigger) {
        return ar.reply;
      }
      if (ar.matchType === 'contains' && lower.includes(ar.trigger)) {
        return ar.reply;
      }
      if (ar.matchType === 'startswith' && lower.startsWith(ar.trigger)) {
        return ar.reply;
      }
    }
    return null;
  }

  // --- Bump Reminder ---
  public async setupBumpReminder(guildId: string, channelId: string) {
    return this.repository.setupBumpReminder(guildId, channelId);
  }

  public async disableBumpReminder(guildId: string) {
    return this.repository.disableBumpReminder(guildId);
  }

  public async getBumpReminder(guildId: string) {
    return this.repository.getBumpReminder(guildId);
  }

  // --- Social Alerts ---
  public async addSocialAlert(
    guildId: string,
    platform: string,
    account: string,
    channelId: string,
  ): Promise<void> {
    await this.repository.addSocialAlert(guildId, platform, account, channelId);
  }

  public async removeSocialAlert(guildId: string, platform: string, account: string): Promise<boolean> {
    return this.repository.removeSocialAlert(guildId, platform, account);
  }

  public async listSocialAlerts(guildId: string): Promise<SocialAlertItem[]> {
    return this.repository.listSocialAlerts(guildId);
  }

  // --- Booster Roles ---
  public async getBoosterRole(guildId: string, userId: string) {
    return this.repository.getBoosterRole(guildId, userId);
  }

  public async createBoosterRole(
    guild: Guild,
    member: GuildMember,
    name: string,
    colorHex: string,
  ): Promise<string> {
    const role = await guild.roles.create({
      name,
      color: colorHex as ColorResolvable,
      reason: `Booster custom role for ${member.user.tag}`,
    });

    await member.roles.add(role, 'Assigned booster role');
    await this.repository.setBoosterRole(guild.id, member.id, role.id);
    return role.id;
  }

  public async deleteBoosterRole(guild: Guild, member: GuildMember): Promise<boolean> {
    const existing = await this.repository.getBoosterRole(guild.id, member.id);
    if (!existing) return false;

    const role = guild.roles.cache.get(existing.roleId);
    if (role) {
      await role.delete('Deleted booster custom role').catch(() => null);
    }
    return this.repository.deleteBoosterRole(guild.id, member.id);
  }
}
