import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GuildMember, Message, MessageReaction, User } from 'discord.js';
import { CommunityService } from '../../src/modules/community/service.js';
import type { PrismaCommunityRepository } from '../../src/database/repositories/community-repository.js';
import { createCommunityModule } from '../../src/modules/community/index.js';

describe('CommunityService', () => {
  let mockRepo: PrismaCommunityRepository;
  let service: CommunityService;

  beforeEach(() => {
    mockRepo = {
      addAutoRole: vi.fn().mockResolvedValue(undefined),
      removeAutoRole: vi.fn().mockResolvedValue(true),
      listAutoRoles: vi
        .fn()
        .mockResolvedValue([{ id: 'ar1', roleId: 'role_newbie', targetType: 'all' }]),
      addReactionRole: vi.fn().mockResolvedValue(undefined),
      removeReactionRole: vi.fn().mockResolvedValue(true),
      deleteReactionRoleByMessage: vi.fn().mockResolvedValue(true),
      listReactionRoles: vi
        .fn()
        .mockResolvedValue([
          { id: 'rr1', channelId: 'c1', messageId: 'm1', emoji: '⭐', roleId: 'role_star' },
        ]),
      addVanityRole: vi.fn().mockResolvedValue(undefined),
      removeVanityRole: vi.fn().mockResolvedValue(true),
      listVanityRoles: vi
        .fn()
        .mockResolvedValue([{ id: 'vr1', keyword: '.gg/riffly', roleId: 'role_supporter' }]),
      getInvites: vi.fn().mockResolvedValue({
        joins: 10,
        leaves: 2,
        fake: 1,
        total: 7,
      }),
      createTimer: vi.fn().mockResolvedValue({
        id: 't1',
        name: 'pizza',
        channelId: 'c1',
        durationSeconds: 600,
        endsAt: new Date(Date.now() + 600000),
        paused: false,
        remainingSeconds: null,
        creatorId: 'u1',
      }),
      listTimers: vi.fn().mockResolvedValue([]),
      cancelTimer: vi.fn().mockResolvedValue(true),
      pauseTimer: vi.fn().mockResolvedValue(true),
      resumeTimer: vi.fn().mockResolvedValue(true),
      getCounting: vi.fn().mockResolvedValue({
        guildId: 'g1',
        channelId: 'count_chan',
        currentNumber: 5,
        lastUserId: 'u_prev',
      }),
      setupCounting: vi.fn().mockResolvedValue(undefined),
      updateCount: vi.fn().mockResolvedValue(undefined),
      resetCounting: vi.fn().mockResolvedValue(undefined),
      disableCounting: vi.fn().mockResolvedValue(undefined),
      addAutoResponder: vi.fn().mockResolvedValue(undefined),
      removeAutoResponder: vi.fn().mockResolvedValue(true),
      clearAutoResponders: vi.fn().mockResolvedValue(1),
      listAutoResponders: vi.fn().mockResolvedValue([
        { id: 'ar1', trigger: 'hello', reply: 'Hi there!', matchType: 'exact' },
        { id: 'ar2', trigger: 'riffly', reply: 'Best music bot!', matchType: 'contains' },
      ]),
      setupClownboard: vi.fn().mockResolvedValue(undefined),
      disableClownboard: vi.fn().mockResolvedValue(undefined),
      getClownboard: vi
        .fn()
        .mockResolvedValue({ guildId: 'g1', channelId: 'c1', threshold: 3, enabled: true }),
      setupBumpReminder: vi.fn().mockResolvedValue(undefined),
      disableBumpReminder: vi.fn().mockResolvedValue(undefined),
      getBumpReminder: vi.fn().mockResolvedValue(null),
      addSocialAlert: vi.fn().mockResolvedValue(undefined),
      removeSocialAlert: vi.fn().mockResolvedValue(true),
      listSocialAlerts: vi.fn().mockResolvedValue([]),
      getBoosterRole: vi.fn().mockResolvedValue(null),
      setBoosterRole: vi.fn().mockResolvedValue(undefined),
      deleteBoosterRole: vi.fn().mockResolvedValue(true),
    } as unknown as PrismaCommunityRepository;

    service = new CommunityService(mockRepo);
  });

  it('assigns autoroles on member join', async () => {
    const addRoleFn = vi.fn().mockResolvedValue(undefined);
    const mockMember = {
      guild: {
        id: 'g1',
        roles: { cache: new Map([['role_newbie', { id: 'role_newbie' }]]) },
      },
      user: { bot: false },
      roles: { add: addRoleFn },
    } as unknown as GuildMember;

    await service.handleMemberJoin(mockMember);
    expect(addRoleFn).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'role_newbie' }),
      expect.any(String),
    );
  });

  it('handles reaction roles add and remove correctly', async () => {
    const addRoleFn = vi.fn().mockResolvedValue(undefined);
    const removeRoleFn = vi.fn().mockResolvedValue(undefined);
    const mockMember = {
      roles: { add: addRoleFn, remove: removeRoleFn },
    };

    const mockReaction = {
      message: {
        id: 'm1',
        guild: {
          id: 'g1',
          roles: { cache: new Map([['role_star', { id: 'role_star' }]]) },
          members: { fetch: vi.fn().mockResolvedValue(mockMember) },
        },
      },
      emoji: { name: '⭐', id: null },
    } as unknown as MessageReaction;

    const mockUser = { id: 'u1', bot: false } as unknown as User;

    // Reaction Add
    await service.handleReaction(mockReaction, mockUser, true);
    expect(addRoleFn).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'role_star' }),
      expect.any(String),
    );

    // Reaction Remove
    await service.handleReaction(mockReaction, mockUser, false);
    expect(removeRoleFn).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'role_star' }),
      expect.any(String),
    );
  });

  it('evaluates autoresponders with exact and substring matching', async () => {
    const exact = await service.evaluateAutoResponder('g1', 'hello');
    expect(exact).toBe('Hi there!');

    const contains = await service.evaluateAutoResponder('g1', 'I really like riffly music');
    expect(contains).toBe('Best music bot!');

    const noMatch = await service.evaluateAutoResponder('g1', 'unknown random text');
    expect(noMatch).toBeNull();
  });

  it('handles counting game advancement and failure streaks', async () => {
    const reactFn = vi.fn().mockResolvedValue(undefined);
    const sendFn = vi.fn().mockResolvedValue(undefined);

    const makeMsg = (content: string, authorId: string) =>
      ({
        guild: { id: 'g1' },
        channel: { id: 'count_chan', send: sendFn },
        author: { id: authorId, bot: false },
        content,
        react: reactFn,
      }) as unknown as Message;

    // Correct next number (current = 5, expected = 6)
    const success = await service.handleCountingMessage(makeMsg('6', 'user_new'));
    expect(success).toBe(true);
    expect(reactFn).toHaveBeenCalledWith('✅');

    // Wrong number (current = 5, sent = 7)
    const failure = await service.handleCountingMessage(makeMsg('7', 'user_new'));
    expect(failure).toBe(false);
    expect(reactFn).toHaveBeenCalledWith('❌');
    expect(sendFn).toHaveBeenCalledWith(expect.stringContaining('ruined the streak'));
  });

  it('exports valid community module with all 11 community commands', () => {
    const mod = createCommunityModule(service);
    expect(mod.id).toBe('community');
    expect(mod.commands).toHaveLength(11);
    const names = mod.commands?.map((c: { name: string }) => c.name);
    expect(names).toEqual([
      'autorole',
      'reactionrole',
      'vanityrole',
      'clownboard',
      'counter',
      'autoresponder',
      'invites',
      'timer',
      'bumper',
      'social',
      'boosterrole',
    ]);
  });
});
