import { describe, expect, it, vi } from 'vitest';
import type { ChatInputCommandInteraction } from 'discord.js';
import { createUtilityCommands } from '../../src/modules/utility/commands.js';
import type { TaskScheduler } from '../../src/scheduler/task-scheduler.js';

describe('UtilityModule', () => {
  const scheduleTaskMock = vi.fn().mockResolvedValue({ id: 'task-remind-1' });
  const scheduler = {
    scheduleTask: scheduleTaskMock,
  } as unknown as TaskScheduler;

  const commands = createUtilityCommands(scheduler);
  const userinfoCmd = commands.find((c) => c.name === 'userinfo')!;
  const serverinfoCmd = commands.find((c) => c.name === 'serverinfo')!;
  const avatarCmd = commands.find((c) => c.name === 'avatar')!;
  const pollCmd = commands.find((c) => c.name === 'poll')!;
  const remindmeCmd = commands.find((c) => c.name === 'remindme')!;

  it('provides all 5 core utility commands', () => {
    expect(commands.map((c) => c.name)).toEqual([
      'userinfo',
      'serverinfo',
      'avatar',
      'poll',
      'remindme',
    ]);
  });

  it('executes /userinfo and edits reply with rich embed', async () => {
    const editReplyFn = vi.fn().mockResolvedValue(true);
    const deferReplyFn = vi.fn().mockResolvedValue(true);

    const interaction = {
      deferReply: deferReplyFn,
      editReply: editReplyFn,
      user: {
        id: 'user-self',
        username: 'SelfUser',
        bot: false,
        createdTimestamp: Date.now() - 10000000,
        displayAvatarURL: () => 'https://cdn.discordapp.com/avatar.png',
      },
      guildId: 'guild-1',
      guild: {
        members: {
          cache: new Map([
            [
              'user-self',
              {
                joinedTimestamp: Date.now() - 5000000,
                roles: {
                  highest: { id: 'role-mod' },
                  cache: new Map([
                    ['role-mod', { id: 'role-mod' }],
                    ['guild-1', { id: 'guild-1' }],
                  ]),
                },
              },
            ],
          ]),
        },
      },
      options: {
        getUser: vi.fn().mockReturnValue(null),
      },
    } as unknown as ChatInputCommandInteraction;

    await userinfoCmd.execute(interaction);
    expect(deferReplyFn).toHaveBeenCalled();
    const callArg = editReplyFn.mock.calls[0]?.[0] as { embeds?: unknown[] } | undefined;
    expect(callArg?.embeds?.length).toBeGreaterThan(0);
  });

  it('executes /serverinfo and displays server stats', async () => {
    const editReplyFn = vi.fn().mockResolvedValue(true);
    const deferReplyFn = vi.fn().mockResolvedValue(true);

    const interaction = {
      deferReply: deferReplyFn,
      editReply: editReplyFn,
      guild: {
        id: 'guild-100',
        name: 'Super Server',
        ownerId: 'owner-1',
        createdTimestamp: Date.now() - 50000000,
        memberCount: 250,
        channels: { cache: new Map([['c1', {}], ['c2', {}]]) },
        premiumTier: 2,
        premiumSubscriptionCount: 7,
        iconURL: () => 'https://cdn.discordapp.com/icon.png',
      },
    } as unknown as ChatInputCommandInteraction;

    await serverinfoCmd.execute(interaction);
    const callArg = editReplyFn.mock.calls[0]?.[0] as { embeds?: unknown[] } | undefined;
    expect(callArg?.embeds?.length).toBeGreaterThan(0);
  });

  it('executes /avatar and returns download links', async () => {
    const editReplyFn = vi.fn().mockResolvedValue(true);
    const deferReplyFn = vi.fn().mockResolvedValue(true);

    const interaction = {
      deferReply: deferReplyFn,
      editReply: editReplyFn,
      user: {
        username: 'TestUser',
        displayAvatarURL: () => 'https://cdn.discordapp.com/avatar.png',
      },
      options: {
        getUser: vi.fn().mockReturnValue(null),
      },
    } as unknown as ChatInputCommandInteraction;

    await avatarCmd.execute(interaction);
    const callArg = editReplyFn.mock.calls[0]?.[0] as { embeds?: unknown[] } | undefined;
    expect(callArg?.embeds?.length).toBeGreaterThan(0);
  });

  it('executes /poll and adds reaction emojis for voting', async () => {
    const reactFn = vi.fn().mockResolvedValue(true);
    const editReplyFn = vi.fn().mockResolvedValue({ react: reactFn });
    const deferReplyFn = vi.fn().mockResolvedValue(true);

    const interaction = {
      deferReply: deferReplyFn,
      editReply: editReplyFn,
      user: { username: 'Pollster' },
      options: {
        getString: vi.fn((name: string) => {
          if (name === 'question') return 'Favorite music genre?';
          if (name === 'options') return 'Rock, Pop, Jazz';
          return null;
        }),
      },
    } as unknown as ChatInputCommandInteraction;

    await pollCmd.execute(interaction);
    expect(editReplyFn).toHaveBeenCalled();
    expect(reactFn).toHaveBeenCalledTimes(3);
  });

  it('executes /remindme and schedules task via TaskScheduler', async () => {
    const editReplyFn = vi.fn().mockResolvedValue(true);
    const deferReplyFn = vi.fn().mockResolvedValue(true);

    const interaction = {
      deferReply: deferReplyFn,
      editReply: editReplyFn,
      user: { id: 'user-reminder' },
      guildId: 'guild-1',
      channelId: 'chan-1',
      options: {
        getString: vi.fn((name: string) => {
          if (name === 'duration') return '10m';
          if (name === 'reason') return 'Take medicine';
          return null;
        }),
      },
    } as unknown as ChatInputCommandInteraction;

    await remindmeCmd.execute(interaction);
    expect(scheduleTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({
        guildId: 'guild-1',
        taskType: 'reminder',
        payload: {
          userId: 'user-reminder',
          channelId: 'chan-1',
          reason: 'Take medicine',
        },
      }),
    );
    const callArg = editReplyFn.mock.calls[0]?.[0] as { content?: string } | undefined;
    expect(callArg?.content).toContain('Reminder set!');
  });
});
