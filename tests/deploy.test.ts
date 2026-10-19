import { describe, expect, it, vi } from 'vitest';
import type { REST } from 'discord.js';
import { Routes } from 'discord.js';
import { registerCommands } from '../src/deploy-commands.js';
import type { Command } from '../src/commands/types.js';

describe('registerCommands', () => {
  const fakeCommand: Command = {
    data: {
      name: 'ping',
      toJSON: () => ({ name: 'ping', description: 'Replies with Pong' }),
    },
    execute: vi.fn(),
  };

  it('deploys to guild route when discordGuildId is provided', async () => {
    const putMock = vi.fn().mockResolvedValue([]);
    const fakeRest = { put: putMock } as unknown as REST;

    const result = await registerCommands(
      {
        discordToken: 'mock-token',
        discordClientId: '123456789012345678',
        discordGuildId: '987654321098765432',
        lavalink: {
          host: 'localhost',
          port: 2333,
          password: 'youshallnotpass',
          secure: false,
        },
      },
      fakeRest,
      [fakeCommand],
    );

    expect(result).toEqual({
      scope: 'guild',
      targetId: '987654321098765432',
      commandCount: 1,
    });

    expect(putMock).toHaveBeenCalledWith(
      Routes.applicationGuildCommands('123456789012345678', '987654321098765432'),
      { body: [{ name: 'ping', description: 'Replies with Pong' }] },
    );
  });

  it('deploys to global route when discordGuildId is omitted', async () => {
    const putMock = vi.fn().mockResolvedValue([]);
    const fakeRest = { put: putMock } as unknown as REST;

    const result = await registerCommands(
      {
        discordToken: 'mock-token',
        discordClientId: '123456789012345678',
        lavalink: {
          host: 'localhost',
          port: 2333,
          password: 'youshallnotpass',
          secure: false,
        },
      },
      fakeRest,
      [fakeCommand],
    );

    expect(result).toEqual({
      scope: 'global',
      targetId: '123456789012345678',
      commandCount: 1,
    });

    expect(putMock).toHaveBeenCalledWith(Routes.applicationCommands('123456789012345678'), {
      body: [{ name: 'ping', description: 'Replies with Pong' }],
    });
  });
});
