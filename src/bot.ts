import { Client, Events, GatewayIntentBits } from 'discord.js';
import type { AppConfig } from './config.js';
import type { Command } from './commands/types.js';
import { buildCommandMap } from './commands/index.js';
import { handleInteraction, setDefaultPlayerManager } from './interaction.js';
import { LavalinkMusicEngine } from './audio/lavalink-engine.js';
import { GuildPlayerManager } from './player/guild-player.js';
import { ProviderRegistry } from './provider/registry.js';
import { LavalinkProvider } from './provider/lavalink-provider.js';
import { TrackResolver } from './provider/resolver.js';

export interface RifflyBot {
  readonly client: Client;
  readonly playerManager?: GuildPlayerManager;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface CreateBotOptions {
  readonly client?: Client;
  readonly commands?: ReadonlyMap<string, Command>;
  readonly playerManager?: GuildPlayerManager;
}

export type BotOptions = CreateBotOptions;

export function createBot(config: AppConfig, options: BotOptions = {}): RifflyBot {
  const client =
    options.client ??
    new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
    });

  let engine: LavalinkMusicEngine | undefined;
  let playerManager = options.playerManager;

  if (!playerManager) {
    engine = new LavalinkMusicEngine({ client, config });
    playerManager = new GuildPlayerManager(engine);
  }

  setDefaultPlayerManager(playerManager);

  // Set up audio engine and player stack (only if real client is used)
  let commands: ReadonlyMap<string, Command>;

  if (options.commands) {
    commands = options.commands;
  } else {
    const activeEngine = engine ?? new LavalinkMusicEngine({ client, config });
    if (!engine) {
      engine = activeEngine;
    }

    const registry = new ProviderRegistry();
    const lavalinkProvider = new LavalinkProvider({ manager: activeEngine.manager });
    // SoundCloud is the primary search/URL source via Lavalink built-in sc source
    registry.register(lavalinkProvider, [
      'soundcloud.com',
      'www.soundcloud.com',
      'on.soundcloud.com',
    ]);

    const resolver = new TrackResolver({ registry });

    commands = buildCommandMap(playerManager, resolver);
  }

  if (engine) {
    // Initialize Lavalink manager after bot is ready
    client.once(Events.ClientReady, () => {
      void engine.init().catch((err: unknown) => {
        console.error(
          '[Bot] Failed to initialize Lavalink manager:',
          err instanceof Error ? err.message : err,
        );
      });
    });
  }

  client.once(Events.ClientReady, (readyClient) => {
    console.log(`[Bot] Logged in as ${readyClient.user.tag}! Gateway connection established.`);
  });

  client.on(Events.InteractionCreate, (interaction) => {
    void handleInteraction(interaction, commands, playerManager);
  });

  client.on(Events.Error, (error) => {
    console.error('[Bot] Discord gateway error:', error instanceof Error ? error.message : error);
  });

  client.on(Events.Warn, (warning) => {
    console.warn('[Bot] Discord gateway warning:', warning);
  });

  return {
    client,
    playerManager,
    async start(): Promise<void> {
      console.log(`[Bot] Connecting to Discord Gateway (Client ID: ${config.discordClientId})...`);
      try {
        await client.login(config.discordToken);
      } catch (error) {
        console.error(
          '[Bot] Login failed:',
          error instanceof Error ? error.message : 'Unknown login error',
        );
        throw error;
      }
    },
    async stop(): Promise<void> {
      console.log('[Bot] Disconnecting from Discord Gateway...');
      await client.destroy();
    },
  };
}
