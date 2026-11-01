import { describe, it, expect, vi } from 'vitest';
import type { ChatInputCommandInteraction } from 'discord.js';
import { createFunModule } from '../../src/modules/fun/index.js';
import { createExtendedUtilityCommands } from '../../src/modules/utility/commands-extended.js';

describe('Fun & Games and Extended Utilities', () => {
  it('creates valid fun module definition with 8 entertainment commands', () => {
    const mod = createFunModule();
    expect(mod.id).toBe('fun');
    expect(mod.commands).toHaveLength(8);
    const names = mod.commands?.map((c: { name: string }) => c.name);
    expect(names).toEqual([
      'rp',
      'image',
      'tictactoe',
      'trivia',
      'urban',
      'fun',
      'meme',
      'fortnite',
    ]);
  });

  it('executes /fun 8ball and returns prediction', async () => {
    const mod = createFunModule();
    const funCmd = mod.commands?.find((c) => c.name === 'fun');
    expect(funCmd).toBeDefined();

    const replyFn = vi.fn().mockResolvedValue(true);
    const interaction = {
      options: {
        getSubcommand: () => '8ball',
        getString: (name: string) => (name === 'question' ? 'Will Riffly succeed?' : null),
      },
      reply: replyFn,
    } as unknown as ChatInputCommandInteraction;

    await funCmd!.execute(interaction);
    expect(replyFn).toHaveBeenCalledWith(expect.any(Object));
  });

  it('provides 25 extended utility commands', () => {
    const ext = createExtendedUtilityCommands();
    expect(ext).toHaveLength(25);
    const names = ext.map((c) => c.name);
    expect(names).toContain('help');
    expect(names).toContain('info');
    expect(names).toContain('afk');
    expect(names).toContain('suggest');
    expect(names).toContain('crypto');
    expect(names).toContain('weather');
  });

  it('executes /help and outputs full command center categories', async () => {
    const ext = createExtendedUtilityCommands();
    const helpCmd = ext.find((c) => c.name === 'help');
    expect(helpCmd).toBeDefined();

    const replyFn = vi.fn().mockResolvedValue(true);
    const interaction = {
      options: { getString: () => null },
      reply: replyFn,
    } as unknown as ChatInputCommandInteraction;

    await helpCmd!.execute(interaction);
    expect(replyFn).toHaveBeenCalledWith(expect.any(Object));
  });
});
