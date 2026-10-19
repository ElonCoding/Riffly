import { describe, expect, it, vi } from 'vitest';
import { Events } from 'discord.js';
import type { Client } from 'discord.js';
import { createBot } from '../src/bot.js';

describe('createBot', () => {
  const fakeConfig = {
    discordToken: 'mock-token',
    discordClientId: '123456789012345678',
    lavalink: {
      host: 'localhost',
      port: 2333,
      password: 'youshallnotpass',
      secure: false,
    },
  };

  it('registers expected event listeners on the client', () => {
    const onceMock = vi.fn();
    const onMock = vi.fn();
    const fakeClient = {
      once: onceMock,
      on: onMock,
      login: vi.fn(),
      destroy: vi.fn(),
    } as unknown as Client;

    createBot(fakeConfig, { client: fakeClient });

    expect(onceMock).toHaveBeenCalledWith(Events.ClientReady, expect.any(Function));
    expect(onMock).toHaveBeenCalledWith(Events.InteractionCreate, expect.any(Function));
    expect(onMock).toHaveBeenCalledWith(Events.Error, expect.any(Function));
    expect(onMock).toHaveBeenCalledWith(Events.Warn, expect.any(Function));
  });

  it('calls login with configured token on start', async () => {
    const loginMock = vi.fn().mockResolvedValue('mock-token');
    const fakeClient = {
      once: vi.fn(),
      on: vi.fn(),
      login: loginMock,
      destroy: vi.fn(),
    } as unknown as Client;

    const bot = createBot(fakeConfig, { client: fakeClient });
    await bot.start();

    expect(loginMock).toHaveBeenCalledWith('mock-token');
  });

  it('calls destroy on stop', async () => {
    const destroyMock = vi.fn().mockResolvedValue(undefined);
    const fakeClient = {
      once: vi.fn(),
      on: vi.fn(),
      login: vi.fn(),
      destroy: destroyMock,
    } as unknown as Client;

    const bot = createBot(fakeConfig, { client: fakeClient });
    await bot.stop();

    expect(destroyMock).toHaveBeenCalledTimes(1);
  });

  it('propagates error when login fails', async () => {
    const loginMock = vi.fn().mockRejectedValue(new Error('Invalid token'));
    const fakeClient = {
      once: vi.fn(),
      on: vi.fn(),
      login: loginMock,
      destroy: vi.fn(),
    } as unknown as Client;

    const bot = createBot(fakeConfig, { client: fakeClient });
    await expect(bot.start()).rejects.toThrow('Invalid token');
  });
});
