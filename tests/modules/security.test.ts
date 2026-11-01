import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChannelType, type Guild, type GuildMember, type TextChannel } from 'discord.js';
import { SecurityService } from '../../src/modules/security/service.js';
import type { PrismaSecurityRepository } from '../../src/database/repositories/security-repository.js';
import { createSecurityModule } from '../../src/modules/security/index.js';

describe('SecurityService', () => {
  let mockRepo: PrismaSecurityRepository;
  let service: SecurityService;

  beforeEach(() => {
    mockRepo = {
      getAntiNuke: vi.fn().mockResolvedValue({
        enabled: true,
        banThreshold: 2,
        kickThreshold: 3,
        channelDeleteThreshold: 2,
        action: 'ban',
        whitelist: ['trusted_admin'],
      }),
      setAntiNuke: vi.fn().mockImplementation((_gid, data) => Promise.resolve({
        enabled: true,
        banThreshold: 2,
        kickThreshold: 3,
        channelDeleteThreshold: 2,
        action: 'ban',
        whitelist: [],
        ...data,
      })),
      getAntiRaid: vi.fn().mockResolvedValue({
        enabled: true,
        joinThreshold: 3,
        windowSeconds: 5,
        action: 'kick',
        autoLockdown: true,
      }),
      setAntiRaid: vi.fn().mockImplementation((_gid, data) => Promise.resolve({
        enabled: true,
        joinThreshold: 3,
        windowSeconds: 5,
        action: 'kick',
        autoLockdown: true,
        ...data,
      })),
      getAutoMod: vi.fn().mockResolvedValue({
        antiSpam: true,
        antiLinks: true,
        antiCaps: true,
        antiMention: false,
        capsPercentage: 70,
        maxMentions: 5,
        maxMessagesPer5s: 5,
        bannedWords: ['badword'],
        whitelistedChannels: ['chan_1'],
        whitelistedRoles: ['role_1'],
      }),
      setAutoMod: vi.fn().mockImplementation((_gid, data) => Promise.resolve({
        antiSpam: true,
        antiLinks: true,
        antiCaps: true,
        antiMention: false,
        capsPercentage: 70,
        maxMentions: 5,
        maxMessagesPer5s: 5,
        bannedWords: ['badword'],
        whitelistedChannels: ['chan_1'],
        whitelistedRoles: ['role_1'],
        ...data,
      })),
    } as unknown as PrismaSecurityRepository;

    service = new SecurityService(mockRepo);
  });

  it('manages anti-nuke whitelist accurately', async () => {
    const list = await service.addNukeWhitelist('g1', 'new_admin');
    expect(list).toContain('new_admin');

    const removed = await service.removeNukeWhitelist('g1', 'new_admin');
    expect(removed).not.toContain('new_admin');
  });

  it('evaluates anti-nuke triggers and bans rogue moderator exceeding threshold', async () => {
    const banFn = vi.fn().mockResolvedValue(undefined);
    const mockGuild = {
      id: 'g1',
      ownerId: 'server_owner',
      client: { user: { id: 'bot_id' } },
      members: { ban: banFn },
    } as unknown as Guild;

    const mockExecutor = {
      id: 'rogue_mod',
      bannable: true,
    } as unknown as GuildMember;

    // 1st ban - below threshold (2)
    const res1 = await service.handleAuditAction(mockGuild, mockExecutor, 'ban');
    expect(res1).toBe(false);
    expect(banFn).not.toHaveBeenCalled();

    // 2nd ban - hits threshold
    const res2 = await service.handleAuditAction(mockGuild, mockExecutor, 'ban');
    expect(res2).toBe(true);
    expect(banFn).toHaveBeenCalledWith('rogue_mod', expect.any(Object));
    const banOpts = banFn.mock.calls[0]?.[1] as { reason?: string } | undefined;
    expect(banOpts?.reason).toContain('Riffly Anti-Nuke');
  });

  it('ignores whitelisted users and guild owner in anti-nuke', async () => {
    const banFn = vi.fn();
    const mockGuild = {
      id: 'g1',
      ownerId: 'server_owner',
      client: { user: { id: 'bot_id' } },
      members: { ban: banFn },
    } as unknown as Guild;

    const mockOwner = { id: 'server_owner', bannable: true } as unknown as GuildMember;
    const mockWhitelisted = { id: 'trusted_admin', bannable: true } as unknown as GuildMember;

    expect(await service.handleAuditAction(mockGuild, mockOwner, 'ban')).toBe(false);
    expect(await service.handleAuditAction(mockGuild, mockWhitelisted, 'ban')).toBe(false);
    expect(banFn).not.toHaveBeenCalled();
  });

  it('detects raids and triggers mass lockdown on member joins', async () => {
    const editPermsFn = vi.fn().mockResolvedValue(undefined);
    const mockChannel = {
      type: ChannelType.GuildText,
      permissionOverwrites: { edit: editPermsFn },
    } as unknown as TextChannel;

    const mockGuild = {
      id: 'g1',
      roles: { everyone: { id: 'everyone_id' } },
      channels: {
        cache: new Map([['c1', mockChannel]]),
      },
      members: {
        cache: new Map(),
      },
    } as unknown as Guild;

    const kickFn = vi.fn().mockResolvedValue(undefined);
    const createMember = (id: string) => ({
      id,
      guild: mockGuild,
      user: { bot: false },
      kickable: true,
      kick: kickFn,
    } as unknown as GuildMember);

    // Join 1 and 2 (threshold = 3)
    expect(await service.handleMemberJoin(createMember('r1'))).toBe(false);
    expect(await service.handleMemberJoin(createMember('r2'))).toBe(false);

    // Join 3 triggers raid defense and lockdown
    expect(await service.handleMemberJoin(createMember('r3'))).toBe(true);
    expect(editPermsFn).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ SendMessages: false }),
      expect.any(Object),
    );
  });

  it('locks down and lifts lockdown across all text channels', async () => {
    const editPermsFn = vi.fn().mockResolvedValue(undefined);
    const mockChannel = {
      type: ChannelType.GuildText,
      permissionOverwrites: { edit: editPermsFn },
    } as unknown as TextChannel;

    const mockGuild = {
      id: 'g1',
      roles: { everyone: { id: 'everyone_id' } },
      channels: {
        cache: new Map([['c1', mockChannel]]),
      },
    } as unknown as Guild;

    const lockedCount = await service.lockdown(mockGuild, 'Emergency test');
    expect(lockedCount).toBe(1);
    expect(editPermsFn).toHaveBeenCalledWith(expect.anything(), { SendMessages: false }, expect.any(Object));

    const unlockedCount = await service.unlockdown(mockGuild);
    expect(unlockedCount).toBe(1);
    expect(editPermsFn).toHaveBeenCalledWith(expect.anything(), { SendMessages: null }, expect.any(Object));
  });

  it('manages automod banned words and whitelists', async () => {
    const words = await service.addBannedWord('g1', 'toxic');
    expect(words).toContain('toxic');

    const removedWords = await service.removeBannedWord('g1', 'toxic');
    expect(removedWords).not.toContain('toxic');

    const added = await service.addAutoModWhitelist('g1', 'chan_99', 'channel');
    expect(added.channels).toContain('chan_99');
  });

  it('exports valid security module definition with antinuke, antiraid, and automod commands', () => {
    const mod = createSecurityModule(service);
    expect(mod.id).toBe('security');
    expect(mod.commands).toHaveLength(3);
    expect(mod.commands?.map((c: { name: string }) => c.name)).toEqual(['antinuke', 'antiraid', 'automod']);
  });
});
