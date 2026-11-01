import type { MessageReaction, User } from 'discord.js';
import { defineModule } from '../core/define-module.js';
import type { ModuleDefinition } from '../core/types.js';
import { StarboardService } from './service.js';
import type { StarboardContext, StarboardSettings } from './types.js';

export * from './types.js';
export * from './service.js';

export function createStarboardModule(serviceInstance?: StarboardService): ModuleDefinition {
  const service = serviceInstance ?? new StarboardService();

  return defineModule({
    id: 'starboard',
    name: 'Riffly Starboard',
    description: 'Pin standout server messages to a starboard channel using star reaction milestones.',
    version: '1.0.0',
    events: [
      {
        event: 'messageReactionAdd',
        execute: async (args: unknown, context?: unknown) => {
          const pair = Array.isArray(args) ? (args as [MessageReaction, User]) : undefined;
          if (!pair || pair.length < 2) return;
          const [reaction, user] = pair;
          const guildId = reaction.message.guild?.id;
          if (!guildId) return;

          const ctx = context as StarboardContext | undefined;
          const settings = ((await ctx?.getSettings?.(guildId, 'starboard')) ?? {
            enabled: true,
            minStars: 3,
            emoji: '⭐',
            selfStar: false,
          }) as StarboardSettings;

          await service.handleReaction(reaction, user, settings);
        },
      },
    ],
  });
}

