import type { Message } from 'discord.js';
import { defineModule } from '../core/define-module.js';
import type { ModuleDefinition } from '../core/types.js';
import { AutoModService } from './service.js';
import { createAutoModCommands } from './commands.js';
import type { AutoModContext, AutoModSettings } from './types.js';

export * from './types.js';
export * from './service.js';
export * from './commands.js';

export function createAutoModModule(serviceInstance?: AutoModService): ModuleDefinition {
  const service = serviceInstance ?? new AutoModService();

  return defineModule({
    id: 'automod',
    name: 'Riffly AutoMod & Security',
    description:
      'PatternGuard automated server defense: anti-invite, anti-link, anti-caps, mention spam, and rate limits.',
    version: '1.0.0',
    commands: createAutoModCommands(service),
    events: [
      {
        event: 'messageCreate',
        execute: async (arg: unknown, context?: unknown) => {
          const message = arg as Message;
          if (!message?.guild || !message.member || message.author?.bot) return;

          const ctx = context as AutoModContext | undefined;
          const settings = ((await ctx?.getSettings?.(message.guild.id, 'automod')) ?? {
            enabled: true,
            antiInvite: true,
            antiLink: false,
            antiCaps: true,
            capsPercentage: 70,
            antiMentionSpam: true,
            maxMentions: 5,
            antiSpam: true,
            spamMessageThreshold: 5,
            spamTimeWindowSeconds: 5,
            action: 'delete',
          }) as AutoModSettings;

          await service.evaluateMessage(message, settings);
        },
      },
    ],
  });
}
