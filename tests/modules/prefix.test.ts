import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Message } from 'discord.js';
import { PrefixService } from '../../src/modules/prefix/service.js';
import { createPrefixModule } from '../../src/modules/prefix/index.js';

describe('PrefixService', () => {
  let service: PrefixService;

  beforeEach(() => {
    service = new PrefixService();
    // Stub internal Prisma client to isolate from real DB
    const client = (service as unknown as { client: Record<string, unknown> }).client;
    client.guildSettings = {
      findUnique: vi.fn().mockResolvedValue({ prefix: '$' }),
      upsert: vi.fn().mockResolvedValue({ prefix: '!' }),
    };
    client.noPrefixExemption = {
      findUnique: vi.fn().mockImplementation(({ where }: { where: { userId: string } }) => {
        if (where.userId === 'exempt_user') {
          return Promise.resolve({ userId: 'exempt_user', expiresAt: null, grantedBy: 'owner' });
        }
        return Promise.resolve(null);
      }),
      upsert: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn().mockResolvedValue([]),
    };
  });

  it('retrieves and updates custom guild prefix', async () => {
    const prefix = await service.getPrefix('g1');
    expect(prefix).toBe('$');

    const updated = await service.setPrefix('g1', '>');
    expect(updated).toBe('>');
  });

  it('detects no-prefix exemptions correctly', async () => {
    expect(await service.isNoPrefix('exempt_user')).toBe(true);
    expect(await service.isNoPrefix('regular_user')).toBe(false);
  });

  it('resolves commands using custom prefix, fallback ?, and bot mention', async () => {
    const known = new Set(['play', 'skip', 'pause', 'ban']);
    const makeMsg = (content: string, authorId = 'user_1') => ({
      content,
      guildId: 'g1',
      author: { id: authorId },
    } as unknown as Message);

    // 1. Custom prefix ($)
    const res1 = await service.resolveCommand(makeMsg('$play bohemian rhapsody'), known, 'bot_1');
    expect(res1.isCommand).toBe(true);
    expect(res1.commandName).toBe('play');
    expect(res1.args).toEqual(['bohemian', 'rhapsody']);
    expect(res1.prefixUsed).toBe('$');

    // 2. Fallback prefix (?)
    const res2 = await service.resolveCommand(makeMsg('?skip'), known, 'bot_1');
    expect(res2.isCommand).toBe(true);
    expect(res2.commandName).toBe('skip');
    expect(res2.prefixUsed).toBe('?');

    // 3. Mention (<@bot_1>)
    const res3 = await service.resolveCommand(makeMsg('<@bot_1> pause'), known, 'bot_1');
    expect(res3.isCommand).toBe(true);
    expect(res3.commandName).toBe('pause');
    expect(res3.prefixUsed).toBe('@mention');

    // 4. No-prefix exemption for exempt_user
    const res4 = await service.resolveCommand(makeMsg('ban @troll reason', 'exempt_user'), known, 'bot_1');
    expect(res4.isCommand).toBe(true);
    expect(res4.commandName).toBe('ban');
    expect(res4.isNoPrefix).toBe(true);

    // 5. Regular chatter (not a command)
    const res5 = await service.resolveCommand(makeMsg('hello world how are you', 'regular_user'), known, 'bot_1');
    expect(res5.isCommand).toBe(false);
  });

  it('exports valid prefix module definition with /prefix and /template commands', () => {
    const mod = createPrefixModule(service);
    expect(mod.id).toBe('prefix');
    expect(mod.commands).toHaveLength(2);
    expect(mod.commands?.map((c: { name: string }) => c.name)).toEqual(['prefix', 'template']);
  });
});
