import type {
  Client,
  Guild,
  GuildMember,
  Message,
  PartialGuildMember,
  PartialMessage,
  TextChannel,
  VoiceState,
} from 'discord.js';
import { defineModule } from '../core/define-module.js';
import type { ModuleDefinition } from '../core/types.js';
import {
  formatMemberJoinEmbed,
  formatMemberLeaveEmbed,
  formatMessageDeleteEmbed,
  formatMessageUpdateEmbed,
  formatVoiceStateEmbed,
} from './formatters.js';
import { createLoggingCommands } from './commands.js';

export * from './formatters.js';
export * from './commands.js';

export const loggingSettingsSchema = {
  logChannelId: {
    type: 'string' as const,
    defaultValue: '',
  },
  logMessageEvents: {
    type: 'boolean' as const,
    defaultValue: true,
  },
  logMemberEvents: {
    type: 'boolean' as const,
    defaultValue: true,
  },
  logVoiceEvents: {
    type: 'boolean' as const,
    defaultValue: true,
  },
};

export interface CreateLoggingModuleOptions {
  readonly client?: Client | undefined;
}

interface LoggingModuleContext {
  readonly getSettings?: (
    guildId: string,
    moduleId: string,
  ) => Promise<{
    logChannelId?: string;
    logMessageEvents?: boolean;
    logMemberEvents?: boolean;
    logVoiceEvents?: boolean;
  }>;
}

/**
 * Sends a log embed to the configured channel for a given guild.
 */
async function sendLogEmbed(
  guild: Guild,
  channelId: string,
  embed: ReturnType<typeof formatMemberJoinEmbed>,
): Promise<void> {
  if (!channelId) return;

  try {
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (channel && 'send' in channel && typeof (channel as TextChannel).send === 'function') {
      await (channel as TextChannel).send({ embeds: [embed] });
    }
  } catch {
    // Suppress logging channel delivery failures to avoid cascading issues
  }
}

export function createLoggingModule(): ModuleDefinition<typeof loggingSettingsSchema> {
  return defineModule({
    id: 'logging',
    name: 'Riffly Server Logging',
    description: 'Automated audit trail logging for message, member, and voice events.',
    version: '1.0.0',
    settings: loggingSettingsSchema,
    commands: createLoggingCommands(),
    events: [
      {
        event: 'messageDelete',
        execute: async (arg: unknown, context?: unknown) => {
          const message = arg as Message | PartialMessage;
          if (!message?.guild) return;

          const embed = formatMessageDeleteEmbed(message);
          if (!embed) return;

          const ctx = context as LoggingModuleContext | undefined;
          const settings = (await ctx?.getSettings?.(message.guild.id, 'logging')) ?? {
            logChannelId: '',
            logMessageEvents: true,
          };

          if (settings.logMessageEvents && settings.logChannelId) {
            await sendLogEmbed(message.guild, settings.logChannelId, embed);
          }
        },
      },
      {
        event: 'messageUpdate',
        execute: async (args: unknown, context?: unknown) => {
          const pair = Array.isArray(args) ? (args as [PartialMessage, Message]) : undefined;
          if (!pair || pair.length < 2) return;
          const [oldMsg, newMsg] = pair;
          if (!newMsg?.guild || !oldMsg) return;

          const embed = formatMessageUpdateEmbed(oldMsg, newMsg);
          if (!embed) return;

          const ctx = context as LoggingModuleContext | undefined;
          const settings = (await ctx?.getSettings?.(newMsg.guild.id, 'logging')) ?? {
            logChannelId: '',
            logMessageEvents: true,
          };

          if (settings.logMessageEvents && settings.logChannelId) {
            await sendLogEmbed(newMsg.guild, settings.logChannelId, embed);
          }
        },
      },
      {
        event: 'guildMemberAdd',
        execute: async (arg: unknown, context?: unknown) => {
          const member = arg as GuildMember;
          if (!member?.guild) return;

          const embed = formatMemberJoinEmbed(member);

          const ctx = context as LoggingModuleContext | undefined;
          const settings = (await ctx?.getSettings?.(member.guild.id, 'logging')) ?? {
            logChannelId: '',
            logMemberEvents: true,
          };

          if (settings.logMemberEvents && settings.logChannelId) {
            await sendLogEmbed(member.guild, settings.logChannelId, embed);
          }
        },
      },
      {
        event: 'guildMemberRemove',
        execute: async (arg: unknown, context?: unknown) => {
          const member = arg as GuildMember | PartialGuildMember;
          if (!member?.guild) return;

          const embed = formatMemberLeaveEmbed(member);

          const ctx = context as LoggingModuleContext | undefined;
          const settings = (await ctx?.getSettings?.(member.guild.id, 'logging')) ?? {
            logChannelId: '',
            logMemberEvents: true,
          };

          if (settings.logMemberEvents && settings.logChannelId) {
            await sendLogEmbed(member.guild, settings.logChannelId, embed);
          }
        },
      },
      {
        event: 'voiceStateUpdate',
        execute: async (args: unknown, context?: unknown) => {
          const pair = Array.isArray(args) ? (args as [VoiceState, VoiceState]) : undefined;
          if (!pair || pair.length < 2) return;
          const [oldState, newState] = pair;
          const guild = newState?.guild ?? oldState?.guild;
          if (!guild || !oldState || !newState) return;

          const embed = formatVoiceStateEmbed(oldState, newState);
          if (!embed) return;

          const ctx = context as LoggingModuleContext | undefined;
          const settings = (await ctx?.getSettings?.(guild.id, 'logging')) ?? {
            logChannelId: '',
            logVoiceEvents: true,
          };

          if (settings.logVoiceEvents && settings.logChannelId) {
            await sendLogEmbed(guild, settings.logChannelId, embed);
          }
        },
      },
    ],
  });
}
