import { Client, Events, GatewayIntentBits } from 'discord.js';
import type { AppConfig } from './config.js';
import type { Command } from './commands/types.js';
import { buildMasterCommandMap } from './commands/master-registry.js';
import { handleInteraction, setDefaultPlayerManager } from './interaction.js';
import { LavalinkMusicEngine } from './audio/lavalink-engine.js';
import { GuildPlayerManager } from './player/guild-player.js';
import { ProviderRegistry } from './provider/registry.js';
import { LavalinkProvider } from './provider/lavalink-provider.js';
import { TrackResolver } from './provider/resolver.js';
import { PrefixService } from './modules/prefix/service.js';
import { CommunityService } from './modules/community/service.js';
import { PrismaCommunityRepository } from './database/repositories/community-repository.js';

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
  const usePrivilegedIntents = process.env.DISCORD_PRIVILEGED_INTENTS !== 'false';
  const client =
    options.client ??
    new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        ...(usePrivilegedIntents
          ? [GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers]
          : []),
      ],
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
    const lavalinkProvider = new LavalinkProvider({
      manager: activeEngine.manager,
      searchSource: 'ytsearch',
    });
    // YouTube, SoundCloud, and Bandcamp hostnames
    registry.register(lavalinkProvider, [
      'youtube.com',
      'www.youtube.com',
      'm.youtube.com',
      'youtu.be',
      'music.youtube.com',
      'soundcloud.com',
      'www.soundcloud.com',
      'on.soundcloud.com',
      'bandcamp.com',
    ]);

    const resolver = new TrackResolver({ registry });

    commands = buildMasterCommandMap(playerManager, resolver);
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
    // If running in global mode, clear any residual guild-specific commands to prevent duplicates
    if (!config.discordGuildId) {
      for (const guild of readyClient.guilds.cache.values()) {
        guild.commands.set([]).catch(() => null);
      }
    }
  });

  client.on(Events.InteractionCreate, (interaction) => {
    void handleInteraction(interaction, commands, playerManager);
  });

  const prefixService = new PrefixService();
  const commService = new CommunityService(new PrismaCommunityRepository());

  client.on(Events.MessageCreate, (message) => {
    void (async () => {
      if (message.author.bot || !message.guild) return;

      // 1. Counting channel validation
      try {
        await commService.handleCountingMessage(message);
      } catch {
        // Ignore counting check errors
      }

      // 2. AutoResponder matching
      try {
        const autoReply = await commService.evaluateAutoResponder(
          message.guild.id,
          message.content,
        );
        if (autoReply) {
          await message.channel.send(autoReply);
        }
      } catch {
        // Ignore autoresponder errors
      }

      // 3. Prefix & No-Prefix resolution & moderation message cleanup
      try {
        const knownCommands = new Set(commands.keys());
        const res = await prefixService.resolveCommand(message, knownCommands, client.user?.id);
        if (res.isCommand) {
          const modCommands = new Set([
            'ban',
            'unban',
            'kick',
            'mute',
            'unmute',
            'timeout',
            'warn',
            'purge',
            'jail',
            'unjail',
          ]);
          if (modCommands.has(res.commandName) && message.deletable) {
            void message.delete().catch(() => null);
          }
        }
      } catch {
        // Ignore command resolution errors
      }
    })();
  });

  client.on(Events.MessageReactionAdd, (reaction, user) => {
    void (async () => {
      if (user.bot || !reaction.message.guild) return;
      try {
        const fullReaction = reaction.partial ? await reaction.fetch() : reaction;
        const fullUser = user.partial ? await user.fetch() : user;
        await commService.handleReaction(fullReaction, fullUser, true);
      } catch {
        // Ignore reaction role errors
      }
    })();
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
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error('[Bot] Login failed:', errorMsg);
        if (errorMsg.toLowerCase().includes('disallowed intents')) {
          console.error(
            '\n====================================================================\n' +
              '[ACTION REQUIRED] Privileged Gateway Intents disabled in Discord Portal!\n' +
              `1. Open https://discord.com/developers/applications/${config.discordClientId}/bot\n` +
              '2. Scroll down to "Privileged Gateway Intents"\n' +
              '3. Turn ON "SERVER MEMBERS INTENT" and "MESSAGE CONTENT INTENT"\n' +
              '4. Click "Save Changes" and restart Riffly.\n\n' +
              'Alternatively, set DISCORD_PRIVILEGED_INTENTS=false in .env to boot now.\n' +
              '====================================================================\n',
          );
        }
        throw error;
      }
    },
    async stop(): Promise<void> {
      console.log('[Bot] Disconnecting from Discord Gateway...');
      await client.destroy();
    },
  };
}
