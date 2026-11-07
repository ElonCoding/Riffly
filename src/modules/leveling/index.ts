import type { Message, TextChannel } from 'discord.js';
import { defineModule } from '../core/define-module.js';
import type { ModuleDefinition } from '../core/types.js';
import type { ILevelRepository } from '../../database/types.js';
import { LevelingService } from './service.js';
import { createLevelingCommands } from './commands.js';

export * from './types.js';
export * from './service.js';
export * from './commands.js';

export interface CreateLevelingModuleOptions {
  readonly repository: ILevelRepository;
}

export const levelingSettingsSchema = {
  enabled: {
    type: 'boolean' as const,
    defaultValue: true,
  },
  minXpPerMessage: {
    type: 'number' as const,
    defaultValue: 15,
    validate: (val: unknown) => typeof val === 'number' && val >= 1 && val <= 100,
  },
  maxXpPerMessage: {
    type: 'number' as const,
    defaultValue: 25,
    validate: (val: unknown) => typeof val === 'number' && val >= 1 && val <= 500,
  },
  cooldownSeconds: {
    type: 'number' as const,
    defaultValue: 60,
    validate: (val: unknown) => typeof val === 'number' && val >= 0 && val <= 3600,
  },
  levelUpChannelId: {
    type: 'string' as const,
    defaultValue: '',
  },
};

interface LevelingModuleContext {
  readonly getSettings?: (
    guildId: string,
    moduleId: string,
  ) => Promise<{
    enabled?: boolean;
    minXpPerMessage?: number;
    maxXpPerMessage?: number;
    cooldownSeconds?: number;
    levelUpChannelId?: string;
  }>;
}

export function createLevelingModule(
  options: CreateLevelingModuleOptions,
): ModuleDefinition<typeof levelingSettingsSchema> {
  const service = new LevelingService(options.repository);
  const commands = createLevelingCommands(service);

  return defineModule({
    id: 'leveling',
    name: 'Riffly XP & Leveling',
    description:
      'Chat activity progression, configurable XP cooldowns, rank cards, and leaderboards.',
    version: '1.0.0',
    settings: levelingSettingsSchema,
    commands,
    events: [
      {
        event: 'messageCreate',
        execute: async (arg: unknown, context?: unknown) => {
          const message = arg as Message;
          if (!message?.guild || !message.member || message.author?.bot) return;

          const ctx = context as LevelingModuleContext | undefined;
          const settings = (await ctx?.getSettings?.(message.guild.id, 'leveling')) ?? {
            enabled: true,
            minXpPerMessage: 15,
            maxXpPerMessage: 25,
            cooldownSeconds: 60,
            levelUpChannelId: '',
          };

          if (settings.enabled === false) return;

          let levelUpChannel: TextChannel | undefined;
          if (settings.levelUpChannelId) {
            const fetched = await message.guild.channels
              .fetch(settings.levelUpChannelId)
              .catch(() => null);
            if (
              fetched &&
              'send' in fetched &&
              typeof (fetched as TextChannel).send === 'function'
            ) {
              levelUpChannel = fetched as TextChannel;
            }
          }

          await service.handleMessage(message.member, {
            ...(settings.minXpPerMessage !== undefined ? { minXp: settings.minXpPerMessage } : {}),
            ...(settings.maxXpPerMessage !== undefined ? { maxXp: settings.maxXpPerMessage } : {}),
            ...(settings.cooldownSeconds !== undefined
              ? { cooldownSeconds: settings.cooldownSeconds }
              : {}),
            ...(levelUpChannel ? { levelUpChannel } : {}),
            currentChannel: message.channel,
          });
        },
      },
    ],
  });
}
