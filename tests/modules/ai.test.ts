import { describe, expect, it, vi } from 'vitest';
import type { ChatInputCommandInteraction } from 'discord.js';
import { AiService } from '../../src/modules/ai/service.js';
import { createAiCommands } from '../../src/modules/ai/commands.js';

describe('AiModule', () => {
  it('responds with contextual music knowledge when asked about music', async () => {
    const service = new AiService();
    const result = await service.ask('user-1', 'How do I use the music commands?');

    expect(result.onCooldown).toBe(false);
    expect(result.response).toContain('Lavalink');
    expect(result.response).toContain('/play');
  });

  it('responds with moderation knowledge when asked about bans and kicks', async () => {
    const service = new AiService();
    const result = await service.ask('user-2', 'How does moderation work?');

    expect(result.onCooldown).toBe(false);
    expect(result.response).toContain('/ban');
    expect(result.response).toContain('cases');
  });

  it('enforces cooldown on rapid consecutive queries', async () => {
    const service = new AiService();
    const first = await service.ask('user-fast', 'Help with tickets', 5);
    expect(first.onCooldown).toBe(false);

    const second = await service.ask('user-fast', 'Help with economy', 5);
    expect(second.onCooldown).toBe(true);
    expect(second.remainingSeconds).toBeGreaterThan(0);
  });

  it('executes /ask slash command and formats answer embed', async () => {
    const service = new AiService();
    const commands = createAiCommands(service);
    const askCmd = commands.find((c) => c.name === 'ask')!;

    const editReplyFn = vi.fn().mockResolvedValue(true);
    const deferReplyFn = vi.fn().mockResolvedValue(true);

    const interaction = {
      deferReply: deferReplyFn,
      editReply: editReplyFn,
      user: { id: 'user-interaction' },
      options: {
        getString: vi.fn().mockReturnValue('What is Riffly?'),
      },
    } as unknown as ChatInputCommandInteraction;

    await askCmd.execute(interaction);
    expect(deferReplyFn).toHaveBeenCalled();
    expect(editReplyFn).toHaveBeenCalled();
    const callArg = editReplyFn.mock.calls[0]?.[0] as { embeds?: unknown[] } | undefined;
    expect(callArg?.embeds?.length).toBeGreaterThan(0);
  });
});
