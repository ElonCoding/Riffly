import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { MessageReaction, User, TextChannel } from 'discord.js';
import { StarboardService } from '../../src/modules/starboard/service.js';

describe('StarboardService', () => {
  let service: StarboardService;

  beforeEach(() => {
    service = new StarboardService();
  });

  function createMockReaction(overrides: {
    emojiName?: string;
    count?: number;
    authorId?: string;
    userId?: string;
    isBot?: boolean;
    channelId?: string;
    attachments?: Array<{ contentType?: string; url: string }>;
  }) {
    const sendFn = vi.fn().mockResolvedValue({ id: 'starboard-msg-100' });
    const editFn = vi.fn().mockResolvedValue(true);
    const fetchMsgFn = vi.fn().mockResolvedValue({
      id: 'starboard-msg-100',
      edit: editFn,
    });

    const starboardChannel = {
      id: 'starboard-chan',
      send: sendFn,
      messages: {
        fetch: fetchMsgFn,
      },
    } as unknown as TextChannel;

    const guild = {
      id: 'guild-1',
      channels: {
        fetch: vi.fn((id: string) =>
          Promise.resolve(id === 'starboard-chan' ? starboardChannel : null),
        ),
      },
    };

    const reaction = {
      partial: false,
      emoji: { name: overrides.emojiName ?? '⭐', id: null },
      count: overrides.count ?? 3,
      message: {
        partial: false,
        id: 'msg-orig-1',
        url: 'https://discord.com/channels/1/2/3',
        content: 'Check out this awesome message!',
        createdAt: new Date(),
        author: {
          id: overrides.authorId ?? 'author-1',
          tag: 'Alice#0001',
          displayAvatarURL: () => 'https://cdn.discordapp.com/avatar.png',
        },
        guild,
        channel: { id: overrides.channelId ?? 'orig-chan' },
        attachments: {
          find: (fn: (att: { contentType?: string; url: string }) => boolean) =>
            overrides.attachments?.find(fn),
        },
      },
    } as unknown as MessageReaction;

    const user = {
      id: overrides.userId ?? 'reactor-1',
      bot: overrides.isBot ?? false,
    } as unknown as User;

    return { reaction, user, sendFn, editFn, starboardChannel };
  }

  it('ignores reactions from bot accounts', async () => {
    const { reaction, user, sendFn } = createMockReaction({ isBot: true });
    const posted = await service.handleReaction(reaction, user, {
      enabled: true,
      channelId: 'starboard-chan',
    });

    expect(posted).toBe(false);
    expect(sendFn).not.toHaveBeenCalled();
  });

  it('ignores reactions that do not match configured star emoji', async () => {
    const { reaction, user, sendFn } = createMockReaction({ emojiName: '❤️' });
    const posted = await service.handleReaction(reaction, user, {
      enabled: true,
      channelId: 'starboard-chan',
      emoji: '⭐',
    });

    expect(posted).toBe(false);
    expect(sendFn).not.toHaveBeenCalled();
  });

  it('disallows authors from starring their own messages when selfStar is false', async () => {
    const { reaction, user, sendFn } = createMockReaction({
      authorId: 'user-same',
      userId: 'user-same',
    });
    const posted = await service.handleReaction(reaction, user, {
      enabled: true,
      channelId: 'starboard-chan',
      selfStar: false,
    });

    expect(posted).toBe(false);
    expect(sendFn).not.toHaveBeenCalled();
  });

  it('ignores reactions below minimum star threshold', async () => {
    const { reaction, user, sendFn } = createMockReaction({ count: 2 });
    const posted = await service.handleReaction(reaction, user, {
      enabled: true,
      channelId: 'starboard-chan',
      minStars: 3,
    });

    expect(posted).toBe(false);
    expect(sendFn).not.toHaveBeenCalled();
  });

  it('posts message to starboard channel when threshold is reached', async () => {
    const { reaction, user, sendFn } = createMockReaction({ count: 3 });
    const posted = await service.handleReaction(reaction, user, {
      enabled: true,
      channelId: 'starboard-chan',
      minStars: 3,
    });

    expect(posted).toBe(true);
    expect(sendFn).toHaveBeenCalled();
    const sendArg = sendFn.mock.calls[0]?.[0] as { content?: string; embeds?: unknown[] } | undefined;
    expect(sendArg?.content).toContain('⭐ **3**');
    expect(sendArg?.embeds?.length).toBeGreaterThan(0);
  });

  it('updates existing starboard message when reaction count increases', async () => {
    const first = createMockReaction({ count: 3 });
    await service.handleReaction(first.reaction, first.user, {
      enabled: true,
      channelId: 'starboard-chan',
      minStars: 3,
    });

    const second = createMockReaction({ count: 5 });
    const updated = await service.handleReaction(second.reaction, second.user, {
      enabled: true,
      channelId: 'starboard-chan',
      minStars: 3,
    });

    expect(updated).toBe(true);
    expect(second.editFn).toHaveBeenCalled();
    const editArg = second.editFn.mock.calls[0]?.[0] as { content?: string } | undefined;
    expect(editArg?.content).toContain('⭐ **5**');
  });
});
