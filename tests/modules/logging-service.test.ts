import { describe, expect, it, vi } from 'vitest';
import { LoggingService } from '../../src/modules/logging/service.js';
import { createLoggingCommands } from '../../src/modules/logging/commands.js';
import {
  formatMessageDeleteEmbed,
  formatMessageUpdateEmbed,
  formatMemberJoinEmbed,
  formatMemberLeaveEmbed,
  formatMemberUpdateEmbed,
  formatVoiceStateEmbed,
  formatGuildBanAddEmbed,
  formatGuildBanRemoveEmbed,
  formatChannelCreateEmbed,
  formatChannelDeleteEmbed,
  formatCommandLogEmbed,
} from '../../src/modules/logging/formatters.js';
import type { ChatInputCommandInteraction } from 'discord.js';

describe('Logging Service & Command Suite', () => {
  it('provides logging, loggingset, and setup-logs commands', () => {
    const service = new LoggingService({} as any);
    const cmds = createLoggingCommands(service);
    expect(cmds.length).toBe(3);
    const names = cmds.map((c) => c.name);
    expect(names).toContain('logging');
    expect(names).toContain('loggingset');
    expect(names).toContain('setup-logs');
  });

  it('sets and retrieves log channel in memory cache', async () => {
    const service = new LoggingService({
      guildSettings: { upsert: vi.fn().mockResolvedValue({}) },
      loggingSetting: { upsert: vi.fn().mockResolvedValue({}) },
    } as any);

    await service.setLogChannel('guild-123', 'all', 'chan-999');
    const channels = await service.getLogChannels('guild-123');
    expect(channels['all']).toBe('chan-999');
  });

  it('executes /loggingset command successfully', async () => {
    const service = new LoggingService({
      guildSettings: { upsert: vi.fn().mockResolvedValue({}) },
      loggingSetting: { upsert: vi.fn().mockResolvedValue({}) },
    } as any);

    const cmds = createLoggingCommands(service);
    const loggingsetCmd = cmds.find((c) => c.name === 'loggingset');
    expect(loggingsetCmd).toBeDefined();

    const replyFn = vi.fn().mockResolvedValue(true);
    const interaction = {
      inGuild: () => true,
      guild: { id: 'guild-123' },
      options: {
        getChannel: () => ({ id: 'chan-888', name: 'logs' }),
        getString: () => 'all',
      },
      reply: replyFn,
    } as unknown as ChatInputCommandInteraction;

    await loggingsetCmd!.execute(interaction);
    expect(replyFn).toHaveBeenCalledWith(expect.any(Object));

    const channels = await service.getLogChannels('guild-123');
    expect(channels['all']).toBe('chan-888');
  });

  it('disables log channels successfully', async () => {
    const service = new LoggingService({
      guildSettings: { upsert: vi.fn().mockResolvedValue({}) },
      loggingSetting: {
        upsert: vi.fn().mockResolvedValue({}),
        deleteMany: vi.fn().mockResolvedValue({}),
      },
    } as any);

    await service.setLogChannel('guild-123', 'voice', 'chan-111');
    await service.disableLog('guild-123', 'voice');
    const channels = await service.getLogChannels('guild-123');
    expect(channels['voice']).toBeUndefined();
  });

  it('formats all audit log embeds properly', () => {
    const fakeMember = {
      id: 'user-1',
      user: { tag: 'Test#0001', createdTimestamp: Date.now() - 1000000, displayAvatarURL: () => '' },
      guild: { id: 'guild-1', memberCount: 50 },
    } as any;

    expect(formatMemberJoinEmbed(fakeMember)).toBeDefined();
    expect(formatMemberLeaveEmbed(fakeMember)).toBeDefined();

    const fakeBan = { user: { id: 'user-1', tag: 'Test#0001' }, reason: 'Spam' };
    expect(formatGuildBanAddEmbed(fakeBan)).toBeDefined();
    expect(formatGuildBanRemoveEmbed(fakeBan)).toBeDefined();

    const fakeChan = { id: 'c-1', name: 'general', type: 0 };
    expect(formatChannelCreateEmbed(fakeChan)).toBeDefined();
    expect(formatChannelDeleteEmbed(fakeChan)).toBeDefined();

    const fakeInteraction = {
      commandName: 'play',
      user: { id: 'u-1', tag: 'Test#0001' },
      channelId: 'c-1',
      options: { data: [{ name: 'input', value: 'song' }] },
    };
    expect(formatCommandLogEmbed(fakeInteraction)).toBeDefined();
  });
});
