/**
 * Riffly 4-Tier Staff Hierarchy & 12 Bot Permissions System.
 */

import type { GuildMember } from 'discord.js';

export enum BotPermission {
  BAN = 1 << 0,
  UNBAN = 1 << 1,
  KICK = 1 << 2,
  CHANNELUTILS = 1 << 3,
  WARN = 1 << 4,
  NICK = 1 << 5,
  TIMEOUT = 1 << 6,
  MANAGEROLES = 1 << 7,
  PURGE = 1 << 8,
  SLOWMODE = 1 << 9,
  VCADMIN = 1 << 10,
  MANAGEEMOJIS = 1 << 11,
}

export const ALL_PERMISSIONS_MASK = (1 << 12) - 1;

export const MOD_DEFAULT_PERMISSIONS =
  BotPermission.KICK |
  BotPermission.CHANNELUTILS |
  BotPermission.WARN |
  BotPermission.NICK |
  BotPermission.TIMEOUT |
  BotPermission.PURGE |
  BotPermission.SLOWMODE;

export const ADMIN_DEFAULT_PERMISSIONS = ALL_PERMISSIONS_MASK;

export interface StaffEntry {
  readonly targetId: string;
  readonly targetType: 'user' | 'role';
  readonly tier: 'extraowner' | 'admin' | 'mod';
  readonly permissions: number; // bitfield
}

export interface IStaffRepository {
  getGuildStaff(guildId: string): Promise<readonly StaffEntry[]>;
  setStaff(guildId: string, entry: StaffEntry): Promise<void>;
  removeStaff(guildId: string, targetId: string): Promise<boolean>;
}

export class StaffPermissionEngine {
  private readonly repository: IStaffRepository;
  private readonly globalOwnerIds: ReadonlySet<string>;
  private readonly cache = new Map<string, StaffEntry[]>();

  constructor(repository: IStaffRepository, globalOwnerIds: string[] = []) {
    this.repository = repository;
    this.globalOwnerIds = new Set(globalOwnerIds);
  }

  public isGlobalOwner(userId: string): boolean {
    return this.globalOwnerIds.has(userId);
  }

  public async getStaffList(guildId: string): Promise<readonly StaffEntry[]> {
    const cached = this.cache.get(guildId);
    if (cached) return cached;
    const staff = await this.repository.getGuildStaff(guildId);
    this.cache.set(guildId, [...staff]);
    return staff;
  }

  public async addOrUpdateStaff(guildId: string, entry: StaffEntry): Promise<void> {
    await this.repository.setStaff(guildId, entry);
    this.cache.delete(guildId);
  }

  public async removeStaff(guildId: string, targetId: string): Promise<boolean> {
    const res = await this.repository.removeStaff(guildId, targetId);
    this.cache.delete(guildId);
    return res;
  }

  /**
   * Resolves whether a member possesses a required BotPermission flag.
   */
  public async hasPermission(
    member: GuildMember,
    requiredPerm: BotPermission,
  ): Promise<boolean> {
    // Tier 1: Server Owner or Global Bot Owner
    if (member.guild.ownerId === member.id || this.isGlobalOwner(member.id)) {
      return true;
    }

    const staffList = await this.getStaffList(member.guild.id);
    const memberRoleIds = new Set(member.roles.cache.keys());

    // Check Extra Owner (Tier 2) - full access
    const isExtraOwner = staffList.some(
      (s) =>
        s.tier === 'extraowner' &&
        (s.targetId === member.id || memberRoleIds.has(s.targetId)),
    );
    if (isExtraOwner) {
      return true;
    }

    // Combine effective bitmask across user and role assignments
    let effectivePerms = 0;
    for (const staff of staffList) {
      if (staff.targetId === member.id || memberRoleIds.has(staff.targetId)) {
        effectivePerms |= staff.permissions;
      }
    }

    const req = Number(requiredPerm);
    return (effectivePerms & req) === req;
  }
}
