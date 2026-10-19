import { Client, Events, GatewayIntentBits } from 'discord.js';
import type { AppConfig } from './config.js';
import type { Command } from './commands/types.js';
import { commandMap } from './commands/index.js';
import { handleInteraction } from './interaction.js';

export interface RifflyBot {
  readonly client: Client;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface CreateBotOptions {
  readonly client?: Client;
  readonly commands?: ReadonlyMap<string, Command>;
}

export function createBot(config: AppConfig, options: CreateBotOptions = {}): RifflyBot {
  // Slash command interactions only require Guilds intent; no privileged intents.
  const client =
    options.client ??
    new Client({
      intents: [GatewayIntentBits.Guilds],
    });

  const commands = options.commands ?? commandMap;

  client.once(Events.ClientReady, (readyClient) => {
    console.log(`[Bot] Logged in as ${readyClient.user.tag}! Gateway connection established.`);
  });

  client.on(Events.InteractionCreate, (interaction) => {
    void handleInteraction(interaction, commands);
  });

  client.on(Events.Error, (error) => {
    console.error('[Bot] Discord gateway error:', error instanceof Error ? error.message : error);
  });

  client.on(Events.Warn, (warning) => {
    console.warn('[Bot] Discord gateway warning:', warning);
  });

  return {
    client,
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
