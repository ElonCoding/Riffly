import { describe, expect, it, vi } from 'vitest';
import type { ChatInputCommandInteraction, Interaction } from 'discord.js';
import { handleInteraction } from '../src/interaction.js';
import type { Command } from '../src/commands/types.js';

describe('handleInteraction', () => {
  it('ignores non-chat-input interactions', async () => {
    const fakeInteraction = {
      isChatInputCommand: () => false,
    } as unknown as Interaction;

    await expect(handleInteraction(fakeInteraction, new Map())).resolves.toBeUndefined();
  });

  it('replies ephemeral message for unknown command', async () => {
    const replyMock = vi.fn().mockResolvedValue(undefined);
    const fakeInteraction = {
      isChatInputCommand: () => true,
      commandName: 'unknown',
      isRepliable: () => true,
      replied: false,
      deferred: false,
      reply: replyMock,
    } as unknown as ChatInputCommandInteraction;

    await handleInteraction(fakeInteraction, new Map());

    expect(replyMock).toHaveBeenCalledWith({
      content: 'Unknown command.',
      ephemeral: true,
    });
  });

  it('dispatches to matching command successfully', async () => {
    const executeMock = vi.fn().mockResolvedValue(undefined);
    const fakeCommand: Command = {
      data: {
        name: 'test',
        toJSON: () => ({ name: 'test', description: 'test command' }),
      },
      execute: executeMock,
    };

    const fakeInteraction = {
      isChatInputCommand: () => true,
      commandName: 'test',
    } as unknown as ChatInputCommandInteraction;

    const commands = new Map<string, Command>([['test', fakeCommand]]);
    await handleInteraction(fakeInteraction, commands);

    expect(executeMock).toHaveBeenCalledWith(fakeInteraction);
  });

  it('catches execution error and replies with user error', async () => {
    const executeMock = vi.fn().mockRejectedValue(new Error('Boom'));
    const replyMock = vi.fn().mockResolvedValue(undefined);

    const fakeCommand: Command = {
      data: {
        name: 'fail',
        toJSON: () => ({ name: 'fail', description: 'failing command' }),
      },
      execute: executeMock,
    };

    const fakeInteraction = {
      isChatInputCommand: () => true,
      commandName: 'fail',
      isRepliable: () => true,
      replied: false,
      deferred: false,
      reply: replyMock,
    } as unknown as ChatInputCommandInteraction;

    const commands = new Map<string, Command>([['fail', fakeCommand]]);
    await handleInteraction(fakeInteraction, commands);

    expect(replyMock).toHaveBeenCalledWith({
      content: 'There was an error while executing this command.',
      ephemeral: true,
    });
  });

  it('uses followUp if interaction is already deferred/replied on error', async () => {
    const executeMock = vi.fn().mockRejectedValue(new Error('Async error'));
    const followUpMock = vi.fn().mockResolvedValue(undefined);

    const fakeCommand: Command = {
      data: {
        name: 'asyncfail',
        toJSON: () => ({ name: 'asyncfail', description: 'async failing' }),
      },
      execute: executeMock,
    };

    const fakeInteraction = {
      isChatInputCommand: () => true,
      commandName: 'asyncfail',
      isRepliable: () => true,
      replied: true,
      deferred: false,
      followUp: followUpMock,
    } as unknown as ChatInputCommandInteraction;

    const commands = new Map<string, Command>([['asyncfail', fakeCommand]]);
    await handleInteraction(fakeInteraction, commands);

    expect(followUpMock).toHaveBeenCalledWith({
      content: 'There was an error while executing this command.',
      ephemeral: true,
    });
  });
});
