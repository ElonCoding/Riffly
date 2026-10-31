import { describe, expect, it, vi } from 'vitest';
import { Events } from 'discord.js';
import type { Client, Interaction } from 'discord.js';
import { createBot } from '../src/bot.js';
import { getDefaultPlayerManager } from '../src/interaction.js';
import { GuildPlayerManager } from '../src/player/guild-player.js';

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

  it('registers playerManager with setDefaultPlayerManager and uses options.playerManager if provided', () => {
    const fakeClient = {
      once: vi.fn(),
      on: vi.fn(),
      login: vi.fn(),
      destroy: vi.fn(),
    } as unknown as Client;

    const mockPlayerManager = {
      pause: vi.fn(),
      resume: vi.fn(),
    } as unknown as GuildPlayerManager;

    createBot(fakeConfig, { client: fakeClient, playerManager: mockPlayerManager });

    expect(getDefaultPlayerManager()).toBe(mockPlayerManager);
  });

  it('passes playerManager to handleInteraction on InteractionCreate for button interactions', async () => {
    let interactionListener: ((interaction: Interaction) => void) | undefined;
    const onMock = vi.fn((event: Events, handler: (interaction: Interaction) => void) => {
      if (event === Events.InteractionCreate) {
        interactionListener = handler;
      }
    });

    const fakeClient = {
      once: vi.fn(),
      on: onMock,
      login: vi.fn(),
      destroy: vi.fn(),
    } as unknown as Client;

    const pauseMock = vi.fn().mockResolvedValue(undefined);
    const mockPlayerManager = {
      pause: pauseMock,
    } as unknown as GuildPlayerManager;

    createBot(fakeConfig, { client: fakeClient, playerManager: mockPlayerManager });

    expect(interactionListener).toBeDefined();

    const replyMock = vi.fn().mockResolvedValue(undefined);
    const deferUpdateMock = vi.fn().mockResolvedValue(undefined);
    const fakeButtonInteraction = {
      isChatInputCommand: () => false,
      isButton: () => true,
      customId: 'riffly_pause',
      inGuild: () => true,
      guildId: 'guild-abc',
      member: { voice: { channelId: 'vc-1' } },
      guild: { members: { me: { voice: { channelId: 'vc-1' } } } },
      isRepliable: () => true,
      replied: false,
      deferred: false,
      reply: replyMock,
      deferUpdate: deferUpdateMock,
    } as unknown as Interaction;

    interactionListener!(fakeButtonInteraction);

    await vi.waitFor(() => {
      expect(pauseMock).toHaveBeenCalledWith('guild-abc');
      expect(deferUpdateMock).toHaveBeenCalled();
    });
    expect(replyMock).not.toHaveBeenCalled();
  });

  it('initializes default GuildPlayerManager when options.playerManager is not provided', () => {
    const onMock = vi.fn();
    const fakeClient = {
      once: vi.fn(),
      on: onMock,
      login: vi.fn(),
      destroy: vi.fn(),
    } as unknown as Client;

    createBot(fakeConfig, { client: fakeClient });

    const defaultPm = getDefaultPlayerManager();
    expect(defaultPm).toBeInstanceOf(GuildPlayerManager);
    expect(onMock).toHaveBeenCalledWith(Events.InteractionCreate, expect.any(Function));
  });
});
