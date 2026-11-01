import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ChatInputCommandInteraction } from 'discord.js';
import { createEconomyCommands } from '../../src/modules/economy/commands.js';
import type { IEconomyRepository, UserEconomyData } from '../../src/database/types.js';

describe('EconomyModule', () => {
  let repository: IEconomyRepository;
  let commands: ReturnType<typeof createEconomyCommands>;

  const mockEconomy: UserEconomyData = {
    guildId: 'guild-1',
    userId: 'user-1',
    wallet: 500n,
    bank: 1000n,
    lastDaily: null,
    lastWork: null,
  };

  beforeEach(() => {
    repository = {
      getEconomy: vi.fn().mockResolvedValue(mockEconomy),
      addWallet: vi.fn().mockResolvedValue(mockEconomy),
      deposit: vi.fn().mockResolvedValue({ success: true, data: { ...mockEconomy, wallet: 100n, bank: 1400n } }),
      withdraw: vi.fn().mockResolvedValue({ success: true, data: { ...mockEconomy, wallet: 700n, bank: 800n } }),
      transfer: vi.fn().mockResolvedValue({ success: true }),
      claimDaily: vi.fn().mockResolvedValue({ claimed: true, data: { ...mockEconomy, wallet: 750n } }),
      work: vi.fn().mockResolvedValue({ worked: true, reward: 100n, data: { ...mockEconomy, wallet: 600n } }),
      getLeaderboard: vi.fn().mockResolvedValue([mockEconomy]),
    };

    commands = createEconomyCommands(repository, '🪙');
  });

  it('provides all 7 economy commands', () => {
    expect(commands.map((c) => c.name)).toEqual([
      'balance',
      'daily',
      'work',
      'pay',
      'deposit',
      'withdraw',
      'economy-leaderboard',
    ]);
  });

  it('executes /balance and returns wallet, bank, and net worth', async () => {
    const balanceCmd = commands.find((c) => c.name === 'balance')!;
    const editReplyFn = vi.fn().mockResolvedValue(true);
    const deferReplyFn = vi.fn().mockResolvedValue(true);

    const interaction = {
      deferReply: deferReplyFn,
      editReply: editReplyFn,
      guildId: 'guild-1',
      user: { id: 'user-1', username: 'RichUser', displayAvatarURL: () => 'https://avatar.png' },
      options: { getUser: vi.fn().mockReturnValue(null) },
    } as unknown as ChatInputCommandInteraction;

    await balanceCmd.execute(interaction);
    expect(deferReplyFn).toHaveBeenCalled();
    const callArg = editReplyFn.mock.calls[0]?.[0] as { embeds?: unknown[] } | undefined;
    expect(callArg?.embeds?.length).toBeGreaterThan(0);
  });

  it('executes /daily and awards coins', async () => {
    const dailyCmd = commands.find((c) => c.name === 'daily')!;
    const editReplyFn = vi.fn().mockResolvedValue(true);
    const deferReplyFn = vi.fn().mockResolvedValue(true);

    const interaction = {
      deferReply: deferReplyFn,
      editReply: editReplyFn,
      guildId: 'guild-1',
      user: { id: 'user-1' },
    } as unknown as ChatInputCommandInteraction;

    await dailyCmd.execute(interaction);
    const callArg = editReplyFn.mock.calls[0]?.[0] as { content?: string } | undefined;
    expect(callArg?.content).toContain('claimed your daily reward');
  });

  it('executes /pay and rejects transferring to a bot user', async () => {
    const payCmd = commands.find((c) => c.name === 'pay')!;
    const editReplyFn = vi.fn().mockResolvedValue(true);
    const deferReplyFn = vi.fn().mockResolvedValue(true);

    const interaction = {
      deferReply: deferReplyFn,
      editReply: editReplyFn,
      guildId: 'guild-1',
      user: { id: 'user-1' },
      options: {
        getUser: vi.fn().mockReturnValue({ id: 'bot-1', bot: true }),
        getInteger: vi.fn().mockReturnValue(100),
      },
    } as unknown as ChatInputCommandInteraction;

    await payCmd.execute(interaction);
    const callArg = editReplyFn.mock.calls[0]?.[0] as { content?: string } | undefined;
    expect(callArg?.content).toContain('cannot transfer coins to a bot');
  });

  it('executes /pay between members successfully', async () => {
    const payCmd = commands.find((c) => c.name === 'pay')!;
    const editReplyFn = vi.fn().mockResolvedValue(true);
    const deferReplyFn = vi.fn().mockResolvedValue(true);

    const interaction = {
      deferReply: deferReplyFn,
      editReply: editReplyFn,
      guildId: 'guild-1',
      user: { id: 'user-1' },
      options: {
        getUser: vi.fn().mockReturnValue({ id: 'user-friend', bot: false }),
        getInteger: vi.fn().mockReturnValue(150),
      },
    } as unknown as ChatInputCommandInteraction;

    await payCmd.execute(interaction);
    const callArg = editReplyFn.mock.calls[0]?.[0] as { content?: string } | undefined;
    expect(callArg?.content).toContain('Successfully transferred');
  });
});

