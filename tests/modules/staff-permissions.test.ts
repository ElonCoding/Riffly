import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import type { GuildMember } from 'discord.js';
import {
  BotPermission,
  MOD_DEFAULT_PERMISSIONS,
  ADMIN_DEFAULT_PERMISSIONS,
  StaffPermissionEngine,
  type IStaffRepository,
  type StaffEntry,
} from '../../src/modules/core/staff-permissions.js';

describe('StaffPermissionEngine', () => {
  let repository: IStaffRepository;
  let engine: StaffPermissionEngine;
  let staffList: StaffEntry[];
  let getGuildStaffMock: Mock<(guildId: string) => Promise<readonly StaffEntry[]>>;

  beforeEach(() => {
    staffList = [];
    getGuildStaffMock = vi.fn().mockImplementation(() => Promise.resolve(staffList));
    repository = {
      getGuildStaff: getGuildStaffMock,
      setStaff: vi.fn().mockImplementation((_g, entry: StaffEntry) => {
        staffList = staffList.filter((s) => s.targetId !== entry.targetId);
        staffList.push(entry);
        return Promise.resolve();
      }),
      removeStaff: vi.fn().mockImplementation((_g, targetId: string) => {
        const len = staffList.length;
        staffList = staffList.filter((s) => s.targetId !== targetId);
        return Promise.resolve(staffList.length < len);
      }),
    };

    engine = new StaffPermissionEngine(repository, ['global-root-1']);
  });

  function createMember(overrides: {
    userId?: string;
    isOwner?: boolean;
    roles?: string[];
  }): GuildMember {
    const userId = overrides.userId ?? 'user-1';
    const isOwner = overrides.isOwner ?? false;
    const roles = new Map((overrides.roles ?? []).map((r) => [r, { id: r }]));

    return {
      id: userId,
      guild: {
        id: 'guild-1',
        ownerId: isOwner ? userId : 'owner-99',
      },
      roles: {
        cache: roles,
      },
    } as unknown as GuildMember;
  }

  it('Tier 1: grants all permissions to Server Owner', async () => {
    const owner = createMember({ isOwner: true });
    expect(await engine.hasPermission(owner, BotPermission.BAN)).toBe(true);
    expect(await engine.hasPermission(owner, BotPermission.VCADMIN)).toBe(true);
  });

  it('Tier 1: grants all permissions to Global Bot Owner', async () => {
    const rootUser = createMember({ userId: 'global-root-1' });
    expect(await engine.hasPermission(rootUser, BotPermission.BAN)).toBe(true);
  });

  it('Tier 2: grants full permissions to Extra Owner', async () => {
    staffList.push({
      targetId: 'extra-1',
      targetType: 'user',
      tier: 'extraowner',
      permissions: ADMIN_DEFAULT_PERMISSIONS,
    });

    const extraOwner = createMember({ userId: 'extra-1' });
    expect(await engine.hasPermission(extraOwner, BotPermission.BAN)).toBe(true);
    expect(await engine.hasPermission(extraOwner, BotPermission.MANAGEROLES)).toBe(true);
  });

  it('Tier 4: checks moderator default permissions correctly', async () => {
    staffList.push({
      targetId: 'mod-1',
      targetType: 'user',
      tier: 'mod',
      permissions: MOD_DEFAULT_PERMISSIONS,
    });

    const mod = createMember({ userId: 'mod-1' });
    // Mod default includes KICK, TIMEOUT, WARN, PURGE, SLOWMODE
    expect(await engine.hasPermission(mod, BotPermission.KICK)).toBe(true);
    expect(await engine.hasPermission(mod, BotPermission.PURGE)).toBe(true);
    // Mod default does NOT include BAN or MANAGEROLES
    expect(await engine.hasPermission(mod, BotPermission.BAN)).toBe(false);
    expect(await engine.hasPermission(mod, BotPermission.MANAGEROLES)).toBe(false);
  });

  it('supports role-based staff assignments', async () => {
    staffList.push({
      targetId: 'admin-role-id',
      targetType: 'role',
      tier: 'admin',
      permissions: ADMIN_DEFAULT_PERMISSIONS,
    });

    const memberWithRole = createMember({
      userId: 'user-with-role',
      roles: ['admin-role-id'],
    });

    expect(await engine.hasPermission(memberWithRole, BotPermission.BAN)).toBe(true);
  });

  it('caches results and purges cache on staff updates', async () => {
    await engine.getStaffList('guild-1');
    expect(getGuildStaffMock).toHaveBeenCalledTimes(1);

    await engine.getStaffList('guild-1');
    expect(getGuildStaffMock).toHaveBeenCalledTimes(1);

    await engine.addOrUpdateStaff('guild-1', {
      targetId: 'new-admin',
      targetType: 'user',
      tier: 'admin',
      permissions: ADMIN_DEFAULT_PERMISSIONS,
    });

    await engine.getStaffList('guild-1');
    expect(getGuildStaffMock).toHaveBeenCalledTimes(2);
  });
});
