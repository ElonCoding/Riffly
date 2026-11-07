import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GuildMember, TextChannel, User } from 'discord.js';
import {
  LevelingService,
  calculateLevelFromXp,
  getLevelProgress,
  xpNeededForLevel,
} from '../../src/modules/leveling/service.js';
import { createLevelingModule } from '../../src/modules/leveling/index.js';
import type { ILevelRepository, UserLevelData } from '../../src/database/types.js';

describe('LevelingService', () => {
  let mockRepo: ILevelRepository;
  let service: LevelingService;
  let store: Map<string, UserLevelData>;

  beforeEach(() => {
    store = new Map();
    mockRepo = {
      getUserLevel: vi.fn().mockImplementation((guildId: string, userId: string) => {
        const key = `${guildId}:${userId}`;
        return Promise.resolve(
          store.get(key) ?? {
            guildId,
            userId,
            xp: BigInt(0),
            level: 0,
            messagesCount: 0,
            lastXpAt: null,
          },
        );
      }),
      addXp: vi.fn().mockImplementation((guildId: string, userId: string, amount: number) => {
        const key = `${guildId}:${userId}`;
        const existing = store.get(key) ?? {
          guildId,
          userId,
          xp: BigInt(0),
          level: 0,
          messagesCount: 0,
          lastXpAt: null,
        };

        const oldXp = Number(existing.xp);
        const oldLevel = existing.level;
        const newXp = oldXp + amount;
        const newLevel = calculateLevelFromXp(newXp);
        const leveledUp = newLevel > oldLevel;

        const updated: UserLevelData = {
          guildId,
          userId,
          xp: BigInt(newXp),
          level: newLevel,
          messagesCount: existing.messagesCount + 1,
          lastXpAt: new Date(),
        };
        store.set(key, updated);

        return Promise.resolve({
          data: updated,
          leveledUp,
          oldLevel,
          newLevel,
        });
      }),
      getLeaderboard: vi.fn().mockImplementation((guildId: string) => {
        const list = Array.from(store.values()).filter((l) => l.guildId === guildId);
        list.sort((a, b) => Number(b.xp - a.xp));
        return Promise.resolve(list);
      }),
      setUserLevel: vi.fn(),
      addVoiceXp: vi
        .fn()
        .mockImplementation(
          (
            _guildId: string,
            _userId: string,
            minutes: number,
            amount: number,
            computeLevel: (xp: number) => number,
          ) => {
            const oldXp = 0;
            const newXp = amount;
            const oldLevel = computeLevel(oldXp);
            const newLevel = computeLevel(newXp);
            return Promise.resolve({
              voiceMinutes: minutes,
              voiceXp: BigInt(newXp),
              leveledUp: newLevel > oldLevel,
              oldLevel,
              newLevel,
            });
          },
        ),
    };

    service = new LevelingService(mockRepo);
  });

  it('calculates XP progression and level progress accurately', () => {
    expect(xpNeededForLevel(0)).toBe(100);
    expect(xpNeededForLevel(1)).toBe(155);

    expect(calculateLevelFromXp(0)).toBe(0);
    expect(calculateLevelFromXp(99)).toBe(0);
    expect(calculateLevelFromXp(100)).toBe(1);
    expect(calculateLevelFromXp(255)).toBe(2);

    const progress = getLevelProgress(150);
    expect(progress.level).toBe(1);
    expect(progress.currentLevelXp).toBe(50);
    expect(progress.nextLevelXpNeeded).toBe(155);
    expect(progress.percent).toBe(32);
  });

  it('enforces message XP cooldown', async () => {
    const member = {
      id: 'u1',
      guild: { id: 'g1' },
      user: { bot: false, displayAvatarURL: () => 'https://example.com/avatar.png' },
    } as unknown as GuildMember;

    // First message awards XP
    const first = await service.handleMessage(member, {
      minXp: 20,
      maxXp: 20,
      cooldownSeconds: 60,
    });
    expect(first.awarded).toBe(true);
    expect(first.xpGained).toBe(20);

    // Second message immediately within cooldown is throttled
    const second = await service.handleMessage(member, {
      minXp: 20,
      maxXp: 20,
      cooldownSeconds: 60,
    });
    expect(second.awarded).toBe(false);
    expect(second.xpGained).toBe(0);
  });

  it('notifies level up channel upon level advancement', async () => {
    const sendFn = vi.fn().mockResolvedValue({});
    const mockChannel = { send: sendFn } as unknown as TextChannel;

    const member = {
      id: 'u1',
      guild: { id: 'g1' },
      user: {
        bot: false,
        displayAvatarURL: () => 'https://example.com/avatar.png',
      },
    } as unknown as GuildMember;

    const result = await service.handleMessage(member, {
      minXp: 150,
      maxXp: 150,
      cooldownSeconds: 0,
      levelUpChannel: mockChannel,
    });

    expect(result.leveledUp).toBe(true);
    expect(result.newLevel).toBe(1);
    expect(sendFn).toHaveBeenCalledTimes(1);
  });

  it('defaults to current channel for level up notification when no custom channel is set', async () => {
    const sendFn = vi.fn().mockResolvedValue({});
    const mockCurrentChannel = { send: sendFn } as unknown as TextChannel;

    const member = {
      id: 'u_default',
      guild: { id: 'g_default' },
      user: {
        bot: false,
        displayAvatarURL: () => 'https://example.com/avatar.png',
      },
    } as unknown as GuildMember;

    const result = await service.handleMessage(member, {
      minXp: 150,
      maxXp: 150,
      cooldownSeconds: 0,
      currentChannel: mockCurrentChannel,
    });

    expect(result.leveledUp).toBe(true);
    expect(sendFn).toHaveBeenCalledTimes(1);
    const sentData = sendFn.mock.calls[0]?.[0];
    const embed = sentData?.embeds?.[0];
    expect(embed.data.title).toBe('△ Level Up!');
    expect(embed.data.color).toBe(0x8b5cf6);
    expect(embed.data.description).toContain('<@u_default> has reached 💬 **Level 1**! ◆');
  });

  it('awards voice XP and sends voice level up alert', async () => {
    const sendFn = vi.fn().mockResolvedValue({});
    const mockVoiceChat = { send: sendFn } as unknown as TextChannel;

    const member = {
      id: 'u_voice',
      guild: { id: 'g_voice' },
      user: {
        bot: false,
        displayAvatarURL: () => 'https://example.com/voice-avatar.png',
      },
    } as unknown as GuildMember;

    const result = await service.awardVoiceXp(member, 5, {
      xpPerMinute: 120,
      currentChannel: mockVoiceChat,
    });

    expect(result.awarded).toBe(true);
    expect(result.leveledUp).toBe(true);
    expect(result.newLevel).toBe(1);
    expect(sendFn).toHaveBeenCalledTimes(1);
    const embed = sendFn.mock.calls[0]?.[0]?.embeds?.[0];
    expect(embed.data.title).toBe('△ Level Up!');
    expect(embed.data.description).toContain('<@u_voice> has reached 🎶🎤 **Voice Level 1**! ◆');
  });

  it('generates rank embed with progress bar and statistics', async () => {
    store.set('g1:u1', {
      guildId: 'g1',
      userId: 'u1',
      xp: BigInt(50),
      level: 0,
      messagesCount: 5,
      lastXpAt: new Date(),
    });

    const user = {
      id: 'u1',
      username: 'TestUser',
      displayAvatarURL: () => 'https://example.com/avatar.png',
    } as unknown as User;

    const embed = await service.getRankEmbed('g1', user);
    expect(embed.toJSON().title).toContain('Rank Card');
    const fields = embed.toJSON().fields;
    expect(fields?.some((f) => f.name === 'Total XP')).toBe(true);
    expect(fields?.some((f) => f.name === 'Progress to Next Level')).toBe(true);
  });

  it('builds valid leveling module definition', () => {
    const modDef = createLevelingModule({ repository: mockRepo });
    expect(modDef.id).toBe('leveling');
    expect(modDef.commands).toHaveLength(6);
    const names = modDef.commands?.map((c) => c.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'rank',
        'levels',
        'leaderboard',
        'reset',
        'setup-leveling',
        'xp-set',
      ]),
    );
  });
});
