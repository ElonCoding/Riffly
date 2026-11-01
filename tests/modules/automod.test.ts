import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PermissionFlagsBits } from 'discord.js';
import type { Message, GuildMember, TextChannel } from 'discord.js';
import { AutoModService } from '../../src/modules/automod/service.js';

describe('AutoModService', () => {
  let service: AutoModService;

  beforeEach(() => {
    service = new AutoModService();
  });

  function createMockMessage(overrides: {
    content?: string;
    bot?: boolean;
    isAdmin?: boolean;
    userMentions?: number;
    roleMentions?: number;
    channelId?: string;
    roleIds?: string[];
  }) {
    const deleteFn = vi.fn().mockResolvedValue(true);
    const sendFn = vi.fn().mockResolvedValue({
      delete: vi.fn().mockResolvedValue(true),
    });
    const timeoutFn = vi.fn().mockResolvedValue(true);

    const permissions = {
      has: vi.fn((perm: bigint) => {
        if (overrides.isAdmin && perm === PermissionFlagsBits.Administrator) return true;
        return false;
      }),
    };

    const rolesCache = (overrides.roleIds ?? []).map((id) => ({ id }));

    const member = {
      id: 'user-123',
      permissions,
      roles: {
        cache: rolesCache,
      },
      timeout: timeoutFn,
    } as unknown as GuildMember;

    const channel = {
      id: overrides.channelId ?? 'chan-123',
      send: sendFn,
    } as unknown as TextChannel;

    const userMentions = new Map();
    for (let i = 0; i < (overrides.userMentions ?? 0); i++) {
      userMentions.set(`u_${i}`, {});
    }

    const roleMentions = new Map();
    for (let i = 0; i < (overrides.roleMentions ?? 0); i++) {
      roleMentions.set(`r_${i}`, {});
    }

    const msg = {
      content: overrides.content ?? 'Hello world',
      guild: { id: 'guild-123', channels: { fetch: vi.fn() } },
      member,
      author: {
        id: 'user-123',
        bot: overrides.bot ?? false,
      },
      channel,
      mentions: {
        users: userMentions,
        roles: roleMentions,
      },
      delete: deleteFn,
    } as unknown as Message;

    return { msg, deleteFn, timeoutFn, sendFn };
  }

  it('ignores messages from bot users', async () => {
    const { msg, deleteFn } = createMockMessage({ content: 'discord.gg/scam', bot: true });
    const result = await service.evaluateMessage(msg, { antiInvite: true });
    expect(result.triggered).toBe(false);
    expect(deleteFn).not.toHaveBeenCalled();
  });

  it('bypasses administrators from automod checks', async () => {
    const { msg, deleteFn } = createMockMessage({ content: 'discord.gg/legit', isAdmin: true });
    const result = await service.evaluateMessage(msg, { antiInvite: true });
    expect(result.triggered).toBe(false);
    expect(deleteFn).not.toHaveBeenCalled();
  });

  it('detects and deletes discord invite links when antiInvite is enabled', async () => {
    const { msg, deleteFn } = createMockMessage({ content: 'Join here: https://discord.gg/xyz123' });
    const result = await service.evaluateMessage(msg, { antiInvite: true });
    expect(result.triggered).toBe(true);
    expect(result.rule).toBe('anti-invite');
    expect(deleteFn).toHaveBeenCalled();
  });

  it('detects and deletes messages containing banned keywords', async () => {
    const { msg, deleteFn } = createMockMessage({ content: 'Buy cheap tokens at badsite' });
    const result = await service.evaluateMessage(msg, { bannedWords: ['badsite', 'phish'] });
    expect(result.triggered).toBe(true);
    expect(result.rule).toBe('banned-words');
    expect(deleteFn).toHaveBeenCalled();
  });

  it('detects and deletes mention spam exceeding maximum threshold', async () => {
    const { msg, deleteFn } = createMockMessage({
      content: 'Mass ping test',
      userMentions: 6,
    });
    const result = await service.evaluateMessage(msg, { antiMentionSpam: true, maxMentions: 5 });
    expect(result.triggered).toBe(true);
    expect(result.rule).toBe('mention-spam');
    expect(deleteFn).toHaveBeenCalled();
  });

  it('detects excessive uppercase caps spam', async () => {
    const { msg, deleteFn } = createMockMessage({
      content: 'FREE NITRO CLICK HERE NOW PLEASE',
    });
    const result = await service.evaluateMessage(msg, { antiCaps: true, capsPercentage: 70 });
    expect(result.triggered).toBe(true);
    expect(result.rule).toBe('anti-caps');
    expect(deleteFn).toHaveBeenCalled();
  });

  it('applies member timeout when action is configured to timeout', async () => {
    const { msg, timeoutFn } = createMockMessage({ content: 'https://discord.gg/invitelink' });
    const result = await service.evaluateMessage(msg, {
      antiInvite: true,
      action: 'timeout',
      timeoutDurationSeconds: 120,
    });
    expect(result.triggered).toBe(true);
    expect(result.actionTaken).toBe('timeout');
    expect(timeoutFn).toHaveBeenCalledWith(120000, expect.any(String));
  });

  it('triggers anti-spam when rate limit is exceeded', async () => {
    const settings = {
      antiSpam: true,
      spamMessageThreshold: 3,
      spamTimeWindowSeconds: 5,
    };

    const first = createMockMessage({ content: 'Fast message 1' });
    const r1 = await service.evaluateMessage(first.msg, settings);
    expect(r1.triggered).toBe(false);

    const second = createMockMessage({ content: 'Fast message 2' });
    const r2 = await service.evaluateMessage(second.msg, settings);
    expect(r2.triggered).toBe(false);

    const third = createMockMessage({ content: 'Fast message 3' });
    const r3 = await service.evaluateMessage(third.msg, settings);
    expect(r3.triggered).toBe(true);
    expect(r3.rule).toBe('anti-spam');
    expect(third.deleteFn).toHaveBeenCalled();
  });
});
