import { describe, expect, it, vi } from 'vitest';
import type { ChatInputCommandInteraction } from 'discord.js';
import { pingCommand } from '../src/commands/ping.js';

describe('pingCommand', () => {
  it('has valid slash command metadata', () => {
    const json = pingCommand.data.toJSON();
    expect(json.name).toBe('ping');
    expect(json.description).toBe('Replies with Pong and bot latency.');
  });

  it('replies with pong and formatted gateway ping', async () => {
    const replyMock = vi.fn().mockResolvedValue(undefined);
    const fakeInteraction = {
      client: {
        ws: {
          ping: 42,
        },
      },
      reply: replyMock,
    } as unknown as ChatInputCommandInteraction;

    await pingCommand.execute(fakeInteraction);

    expect(replyMock).toHaveBeenCalledTimes(1);
    expect(replyMock).toHaveBeenCalledWith({
      content: 'Pong! Gateway ping: 42ms',
    });
  });

  it('handles negative or pending gateway ping gracefully', async () => {
    const replyMock = vi.fn().mockResolvedValue(undefined);
    const fakeInteraction = {
      client: {
        ws: {
          ping: -1,
        },
      },
      reply: replyMock,
    } as unknown as ChatInputCommandInteraction;

    await pingCommand.execute(fakeInteraction);

    expect(replyMock).toHaveBeenCalledWith({
      content: 'Pong! Gateway ping: measuring...',
    });
  });
});
