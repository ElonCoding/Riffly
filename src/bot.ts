import {
  Client,
  Events,
  GatewayIntentBits,
  type TextBasedChannel,
  type TextChannel,
} from 'discord.js';
import type { AppConfig } from './config.js';
import type { Command } from './commands/types.js';
import { buildMasterCommandMap } from './commands/master-registry.js';
import { handleInteraction, setDefaultPlayerManager } from './interaction.js';
import { LavalinkMusicEngine } from './audio/lavalink-engine.js';
import { NativeVoiceMusicEngine } from './audio/native-voice-engine.js';
import type { MusicEngine } from './audio/types.js';
import { GuildPlayerManager } from './player/guild-player.js';
import { ProviderRegistry } from './provider/registry.js';
import { LavalinkProvider } from './provider/lavalink-provider.js';
import { NativeProvider } from './provider/native-provider.js';
import { TrackResolver } from './provider/resolver.js';
import { PrefixService } from './modules/prefix/service.js';
import { CommunityService } from './modules/community/service.js';
import { PrismaCommunityRepository } from './database/repositories/community-repository.js';
import { GuildRepository } from './database/repositories/guild-repository.js';
import { LevelRepository } from './database/repositories/level-repository.js';
import { LevelingService } from './modules/leveling/service.js';
import {
  getDefaultLoggingService,
  formatMessageDeleteEmbed,
  formatMessageUpdateEmbed,
  formatMemberJoinEmbed,
  formatMemberLeaveEmbed,
  formatMemberUpdateEmbed,
  formatVoiceStateEmbed,
  formatGuildBanAddEmbed,
  formatGuildBanRemoveEmbed,
  formatChannelCreateEmbed,
  formatChannelDeleteEmbed,
  formatCommandLogEmbed,
} from './modules/logging/index.js';

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
        GatewayIntentBits.GuildModeration,
        ...(usePrivilegedIntents
          ? [GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers]
          : []),
      ],
    });

  type InitializableEngine = MusicEngine & { init(): Promise<void> };
  let engine: InitializableEngine | undefined;
  let playerManager = options.playerManager;

  const isNative = config.audioEngineType !== 'lavalink';

  function createDefaultEngine(): InitializableEngine {
    if (isNative) {
      return new NativeVoiceMusicEngine({ client });
    }
    return new LavalinkMusicEngine({ client, config });
  }

  if (!playerManager) {
    engine = createDefaultEngine();
    playerManager = new GuildPlayerManager(engine, { client });
  }

  setDefaultPlayerManager(playerManager);

  // Set up audio engine and player stack (only if real client is used)
  let commands: ReadonlyMap<string, Command>;

  if (options.commands) {
    commands = options.commands;
  } else {
    const activeEngine = engine ?? createDefaultEngine();
    if (!engine) {
      engine = activeEngine;
    }

    const registry = new ProviderRegistry();
    if (isNative) {
      const nativeProvider = new NativeProvider();
      registry.register(nativeProvider, [
        'youtube.com',
        'www.youtube.com',
        'm.youtube.com',
        'youtu.be',
        'music.youtube.com',
        'soundcloud.com',
        'www.soundcloud.com',
        'on.soundcloud.com',
        'bandcamp.com',
        'open.spotify.com',
        'spotify.com',
        'music.apple.com',
      ]);
    } else {
      const lavalinkProvider = new LavalinkProvider({
        manager: (activeEngine as LavalinkMusicEngine).manager,
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
    }

    const resolver = new TrackResolver({ registry });

    commands = buildMasterCommandMap(playerManager, resolver);
  }

  if (engine) {
    // Initialize audio manager after bot is ready
    client.once(Events.ClientReady, () => {
      void engine.init().catch((err: unknown) => {
        console.error(
          '[Bot] Failed to initialize audio engine:',
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

  const loggingService = getDefaultLoggingService();

  client.on(Events.InteractionCreate, (interaction) => {
    void handleInteraction(interaction, commands, playerManager);
    if (interaction.isChatInputCommand() && interaction.guild) {
      const embed = formatCommandLogEmbed(interaction);
      void loggingService.log(interaction.guild, 'bot', embed);
    }
  });

  // Comprehensive Realtime Server Audit Logging
  client.on(Events.MessageDelete, (message) => {
    void (async () => {
      if (!message.guild || message.author?.bot) return;
      const embed = formatMessageDeleteEmbed(message);
      if (embed) await loggingService.log(message.guild, 'message', embed);
    })();
  });

  client.on(Events.MessageUpdate, (oldMessage, newMessage) => {
    void (async () => {
      if (!newMessage.guild || newMessage.author?.bot) return;
      const embed = formatMessageUpdateEmbed(oldMessage, newMessage);
      if (embed) await loggingService.log(newMessage.guild, 'message', embed);
    })();
  });

  client.on(Events.GuildMemberAdd, (member) => {
    void (async () => {
      if (!member.guild) return;
      const embed = formatMemberJoinEmbed(member);
      if (embed) await loggingService.log(member.guild, 'member', embed);
    })();
  });

  client.on(Events.GuildMemberRemove, (member) => {
    void (async () => {
      if (!member.guild) return;
      const embed = formatMemberLeaveEmbed(member);
      if (embed) await loggingService.log(member.guild, 'member', embed);
    })();
  });

  client.on(Events.GuildMemberUpdate, (oldMember, newMember) => {
    void (async () => {
      if (!newMember.guild) return;
      const embed = formatMemberUpdateEmbed(oldMember, newMember);
      if (embed) await loggingService.log(newMember.guild, 'member', embed);
    })();
  });

  client.on(Events.VoiceStateUpdate, (oldState, newState) => {
    void (async () => {
      const guild = newState.guild ?? oldState.guild;
      if (!guild) return;
      const embed = formatVoiceStateEmbed(oldState, newState);
      if (embed) await loggingService.log(guild, 'voice', embed);
    })();
  });

  client.on(Events.GuildBanAdd, (ban) => {
    void (async () => {
      if (!ban.guild) return;
      const embed = formatGuildBanAddEmbed(ban);
      if (embed) await loggingService.log(ban.guild, 'mod', embed);
    })();
  });

  client.on(Events.GuildBanRemove, (ban) => {
    void (async () => {
      if (!ban.guild) return;
      const embed = formatGuildBanRemoveEmbed(ban);
      if (embed) await loggingService.log(ban.guild, 'mod', embed);
    })();
  });

  client.on(Events.ChannelCreate, (channel) => {
    void (async () => {
      if (!channel.guild) return;
      const embed = formatChannelCreateEmbed(channel);
      if (embed) await loggingService.log(channel.guild, 'server', embed);
    })();
  });

  client.on(Events.ChannelDelete, (channel) => {
    void (async () => {
      if (!('guild' in channel) || !channel.guild) return;
      const embed = formatChannelDeleteEmbed(channel);
      if (embed) await loggingService.log(channel.guild, 'server', embed);
    })();
  });

  const prefixService = new PrefixService();
  const commService = new CommunityService(new PrismaCommunityRepository());
  const guildRepo = new GuildRepository();
  const levelRepo = new LevelRepository();
  const levelingService = new LevelingService(levelRepo);

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

      // 4. Default automatic XP progression & Level-up alerts (like OwO / Sentry)
      try {
        const member =
          message.member ??
          (await message.guild.members.fetch(message.author.id).catch(() => null));
        if (member) {
          const modConfig = await guildRepo
            .getModuleConfig(message.guild.id, 'leveling')
            .catch(() => null);
          if (!modConfig || modConfig.enabled !== false) {
            const settings = modConfig?.settings as Record<string, unknown> | undefined;
            let levelUpChannel: TextChannel | undefined;
            if (settings?.levelUpChannelId && typeof settings.levelUpChannelId === 'string') {
              const ch = message.guild.channels.cache.get(settings.levelUpChannelId);
              if (ch && 'send' in ch) levelUpChannel = ch as TextChannel;
            }

            const minXp =
              typeof settings?.minXpPerMessage === 'number' ? settings.minXpPerMessage : 15;
            const maxXp =
              typeof settings?.maxXpPerMessage === 'number' ? settings.maxXpPerMessage : 25;
            const cooldown =
              typeof settings?.cooldownSeconds === 'number' ? settings.cooldownSeconds : 60;

            await levelingService.handleMessage(member, {
              minXp,
              maxXp,
              cooldownSeconds: cooldown,
              ...(levelUpChannel ? { levelUpChannel } : {}),
              currentChannel: message.channel,
            });
          }
        }
      } catch {
        // Ignore leveling errors
      }
    })();
  });

  // Voice XP & Leveling Background Ticker (awards XP to members actively in voice channels)
  const voiceTicker = setInterval(() => {
    void (async () => {
      for (const guild of client.guilds.cache.values()) {
        const voiceStates = guild.voiceStates.cache;
        if (!voiceStates.size) continue;

        try {
          const modConfig = await guildRepo
            .getModuleConfig(guild.id, 'leveling')
            .catch(() => null);
          if (modConfig && modConfig.enabled === false) continue;
          const settings = modConfig?.settings as Record<string, unknown> | undefined;

          let levelUpChannel: TextChannel | undefined;
          if (settings?.levelUpChannelId && typeof settings.levelUpChannelId === 'string') {
            const ch = guild.channels.cache.get(settings.levelUpChannelId);
            if (ch && 'send' in ch) levelUpChannel = ch as TextChannel;
          }

          for (const [, state] of voiceStates) {
            if (!state.channelId) continue;
            const member = state.member;
            if (!member || member.user.bot) continue;
            if (state.deaf || state.selfDeaf) continue;
            if (guild.afkChannelId && state.channelId === guild.afkChannelId) continue;

            const voiceChannel = state.channel;
            const targetChannel =
              levelUpChannel ??
              (voiceChannel && 'send' in voiceChannel
                ? (voiceChannel as unknown as TextBasedChannel)
                : (guild.systemChannel ?? undefined));

            await levelingService.awardVoiceXp(member, 1, {
              ...(levelUpChannel ? { levelUpChannel } : {}),
              ...(targetChannel ? { currentChannel: targetChannel } : {}),
            });
          }
        } catch {
          // Ignore guild voice leveling errors
        }
      }
    })();
  }, 60000);

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
      clearInterval(voiceTicker);
      console.log('[Bot] Disconnecting from Discord Gateway...');
      await client.destroy();
    },
  };
}
