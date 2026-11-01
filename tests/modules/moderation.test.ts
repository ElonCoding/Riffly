import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Guild, GuildMember, TextChannel, User } from 'discord.js';
import {
  ModerationService,
  ModerationHierarchyError,
} from '../../src/modules/moderation/service.js';
import { createModerationModule } from '../../src/modules/moderation/index.js';
import type { IModerationRepository, ModerationCaseData } from '../../src/database/types.js';

describe('ModerationService', () => {
  let mockRepo: IModerationRepository;
  let service: ModerationService;
  let cases: ModerationCaseData[];

  beforeEach(() => {
    cases = [];
    mockRepo = {
      createCase: vi.fn().mockImplementation((input: {
        guildId: string;
        targetId: string;
        moderatorId: string;
        action: string;
        reason?: string | null;
        durationMs?: bigint | null;
      }) => {
        const c: ModerationCaseData = {
          id: `case_${cases.length + 1}`,
          caseNumber: cases.length + 1,
          guildId: input.guildId,
          targetId: input.targetId,
          moderatorId: input.moderatorId,
          action: input.action,
          reason: input.reason ?? null,
          durationMs: input.durationMs ?? null,
          active: true,
          createdAt: new Date(),
        };
        cases.push(c);
        return Promise.resolve(c);
      }),
      getCase: vi.fn(),
      getCasesForTarget: vi.fn().mockImplementation((_g: string, targetId: string) => {
        return Promise.resolve(cases.filter((c) => c.targetId === targetId));
      }),
      getGuildCases: vi.fn(),
      updateCase: vi.fn(),
      countCases: vi.fn(),
      clearActiveCases: vi.fn().mockResolvedValue(1),
      deleteCase: vi.fn().mockResolvedValue(true),
    };
    service = new ModerationService(mockRepo);
  });

  it('enforces role hierarchy and self-moderation prevention', () => {
    const mod = {
      id: 'mod1',
      guild: { ownerId: 'owner1' },
      roles: { highest: { position: 10 } },
    } as unknown as GuildMember;

    const targetEqual = {
      id: 'target1',
      guild: { ownerId: 'owner1' },
      roles: { highest: { position: 10 } },
    } as unknown as GuildMember;

    const targetHigher = {
      id: 'target2',
      guild: { ownerId: 'owner1' },
      roles: { highest: { position: 12 } },
    } as unknown as GuildMember;

    const targetLower = {
      id: 'target3',
      guild: { ownerId: 'owner1' },
      roles: { highest: { position: 5 } },
    } as unknown as GuildMember;

    // Self check
    expect(() => service.checkHierarchy(mod, mod)).toThrow(ModerationHierarchyError);

    // Owner check
    const owner = {
      id: 'owner1',
      guild: { ownerId: 'owner1' },
      roles: { highest: { position: 99 } },
    } as unknown as GuildMember;
    expect(() => service.checkHierarchy(mod, owner)).toThrow(ModerationHierarchyError);

    // Equal role check
    expect(() => service.checkHierarchy(mod, targetEqual)).toThrow(ModerationHierarchyError);

    // Higher role check
    expect(() => service.checkHierarchy(mod, targetHigher)).toThrow(ModerationHierarchyError);

    // Lower role succeeds
    expect(() => service.checkHierarchy(mod, targetLower)).not.toThrow();
  });

  it('bans member and records case', async () => {
    const banFn = vi.fn().mockResolvedValue(undefined);
    const mockGuild = {
      id: 'g1',
      ownerId: 'owner1',
      members: {
        ban: banFn,
        fetch: vi.fn().mockResolvedValue(null),
        me: { roles: { highest: { position: 50 } } },
      },
    } as unknown as Guild;

    const mod = {
      id: 'mod1',
      user: { tag: 'Mod#0001' },
      guild: mockGuild,
      roles: { highest: { position: 10 } },
    } as unknown as GuildMember;

    const targetUser = {
      id: 'bad_user',
      tag: 'Bad#9999',
    } as unknown as User;

    const result = await service.ban(mockGuild, mod, targetUser, 'Spam attack', 1);
    expect(result.success).toBe(true);
    expect(result.caseNumber).toBe(1);
    expect(banFn).toHaveBeenCalledWith('bad_user', {
      reason: 'Spam attack',
      deleteMessageSeconds: 86400,
    });
  });

  it('kicks member and records case', async () => {
    const kickFn = vi.fn().mockResolvedValue(undefined);
    const mockGuild = {
      id: 'g1',
      ownerId: 'owner1',
      members: {
        me: { roles: { highest: { position: 50 } } },
      },
    } as unknown as Guild;

    const mod = {
      id: 'mod1',
      user: { tag: 'Mod#0001' },
      guild: mockGuild,
      roles: { highest: { position: 10 } },
    } as unknown as GuildMember;

    const targetMember = {
      id: 'member1',
      guild: mockGuild,
      roles: { highest: { position: 2 } },
      kick: kickFn,
    } as unknown as GuildMember;

    const result = await service.kick(mockGuild, mod, targetMember, 'Rule 3 violation');
    expect(result.success).toBe(true);
    expect(result.caseNumber).toBe(1);
    expect(kickFn).toHaveBeenCalledWith('Rule 3 violation');
  });

  it('timeouts member and records case with duration', async () => {
    const timeoutFn = vi.fn().mockResolvedValue(undefined);
    const mockGuild = {
      id: 'g1',
      ownerId: 'owner1',
      members: {
        me: { roles: { highest: { position: 50 } } },
      },
    } as unknown as Guild;

    const mod = {
      id: 'mod1',
      user: { tag: 'Mod#0001' },
      guild: mockGuild,
      roles: { highest: { position: 10 } },
    } as unknown as GuildMember;

    const targetMember = {
      id: 'member1',
      guild: mockGuild,
      roles: { highest: { position: 2 } },
      timeout: timeoutFn,
    } as unknown as GuildMember;

    const result = await service.timeout(mockGuild, mod, targetMember, 60000, 'Trolling');
    expect(result.success).toBe(true);
    expect(timeoutFn).toHaveBeenCalledWith(60000, 'Trolling');
  });

  it('issues warn and records case', async () => {
    const mockGuild = { id: 'g1' } as unknown as Guild;
    const mod = { id: 'mod1' } as unknown as GuildMember;
    const target = { id: 'user1' } as unknown as User;

    const result = await service.warn(mockGuild, mod, target, 'First warning for spam');
    expect(result.success).toBe(true);
    expect(result.action).toBe('warn');
    expect(cases).toHaveLength(1);
  });

  it('softbans by ban then unban', async () => {
    const banFn = vi.fn().mockResolvedValue(undefined);
    const unbanFn = vi.fn().mockResolvedValue(undefined);
    const mockGuild = {
      id: 'g1',
      ownerId: 'owner1',
      members: {
        ban: banFn,
        unban: unbanFn,
        me: { roles: { highest: { position: 50 } } },
      },
    } as unknown as Guild;

    const mod = {
      id: 'mod1',
      user: { tag: 'Mod#0001' },
      guild: mockGuild,
      roles: { highest: { position: 10 } },
    } as unknown as GuildMember;

    const targetMember = {
      id: 'member1',
      guild: mockGuild,
      roles: { highest: { position: 2 } },
    } as unknown as GuildMember;

    const result = await service.softban(mockGuild, mod, targetMember, 'Raid cleanup');
    expect(result.success).toBe(true);
    expect(banFn).toHaveBeenCalled();
    expect(unbanFn).toHaveBeenCalledWith('member1', expect.any(String));
  });

  it('purges messages in text channel', async () => {
    const bulkDeleteFn = vi.fn().mockResolvedValue(new Map([['m1', {}], ['m2', {}]]));
    const mockChannel = {
      bulkDelete: bulkDeleteFn,
    } as unknown as TextChannel;
    const mod = { id: 'mod1' } as unknown as GuildMember;

    const res = await service.purge(mockChannel, mod, 2);
    expect(res.deletedCount).toBe(2);
    expect(bulkDeleteFn).toHaveBeenCalledWith(2, true);
  });

  it('builds valid moderation module definition', () => {
    const modDef = createModerationModule({ repository: mockRepo });
    expect(modDef.id).toBe('moderation');
    expect(modDef.commands?.length).toBeGreaterThanOrEqual(25);
    const cmdNames = modDef.commands?.map((c) => c.name);
    expect(cmdNames).toEqual(
      expect.arrayContaining([
        'ban',
        'unban',
        'kick',
        'timeout',
        'mute',
        'unmute',
        'softban',
        'warn',
        'cases',
        'purge',
        'slowmode',
        'lock',
        'unlock',
        'lockall',
        'unlockall',
        'hide',
        'unhide',
        'vclock',
        'vcunlock',
        'vchide',
        'vcunhide',
        'role',
        'nick',
        'warnings',
        'clearwarns',
        'note',
        'case',
        'editcase',
        'jail',
        'move',
        'moveall',
      ]),
    );
  });

  it('unbans user and records case', async () => {
    const unbanMock = vi.fn().mockResolvedValue(true);
    const mockGuild = {
      id: 'g1',
      members: {
        unban: unbanMock,
      },
    } as unknown as Guild;
    const mod = { id: 'mod1', user: { tag: 'Mod#0001' } } as unknown as GuildMember;

    const res = await service.unban(mockGuild, mod, 'target_123', 'False positive');
    expect(res.success).toBe(true);
    expect(res.action).toBe('unban');
    expect(unbanMock).toHaveBeenCalledWith('target_123', 'False positive');
  });

  it('unmutes user and records case', async () => {
    const timeoutFn = vi.fn().mockResolvedValue(true);
    const mockGuild = { id: 'g1', members: { me: null } } as unknown as Guild;
    const target = {
      id: 'target1',
      guild: mockGuild,
      roles: { highest: { position: 1 } },
      timeout: timeoutFn,
    } as unknown as GuildMember;
    const mod = {
      id: 'mod1',
      guild: mockGuild,
      roles: { highest: { position: 5 } },
    } as unknown as GuildMember;

    const res = await service.unmute(mockGuild, target, mod, 'Good behavior');
    expect(res.success).toBe(true);
    expect(timeoutFn).toHaveBeenCalledWith(null, 'Good behavior');
  });

  it('manages roles and checks hierarchy', async () => {
    const addRoleFn = vi.fn().mockResolvedValue(true);
    const mockGuild = { id: 'g1', members: { me: null } } as unknown as Guild;
    const target = {
      id: 'target1',
      guild: mockGuild,
      roles: { add: addRoleFn },
    } as unknown as GuildMember;
    const mod = {
      id: 'mod1',
      guild: mockGuild,
      roles: { highest: { position: 10 } },
      user: { tag: 'Mod#0001' },
    } as unknown as GuildMember;
    const role = { id: 'role1', position: 5 } as unknown as import('discord.js').Role;

    await service.manageRole(target, role, true, mod);
    expect(addRoleFn).toHaveBeenCalledWith(role, expect.stringContaining('Role assigned'));

    const higherRole = { id: 'role2', position: 15 } as unknown as import('discord.js').Role;
    await expect(service.manageRole(target, higherRole, true, mod)).rejects.toThrow(
      ModerationHierarchyError,
    );
  });

  it('jails and releases member', async () => {
    const setRolesFn = vi.fn().mockResolvedValue(true);
    const mockGuild = { id: 'g1' } as unknown as Guild;
    const member = {
      id: 'target1',
      roles: {
        cache: new Map([
          ['g1', {}],
          ['role-regular', {}],
        ]),
        set: setRolesFn,
      },
    } as unknown as GuildMember;
    const jailRole = { id: 'jail-role' } as unknown as import('discord.js').Role;

    const prevRoles = await service.jailMember(mockGuild, member, jailRole, 'Bad behavior');
    expect(prevRoles).toEqual(['role-regular']);
    expect(setRolesFn).toHaveBeenCalledWith(['jail-role'], 'Bad behavior');

    await service.releaseJail(member, prevRoles);
    expect(setRolesFn).toHaveBeenCalledWith(['role-regular'], 'Released from jail by staff');
  });
});
