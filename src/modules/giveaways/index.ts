import type { Interaction } from 'discord.js';
import { defineModule } from '../core/define-module.js';
import type { ModuleDefinition } from '../core/types.js';
import type { IGiveawayRepository } from '../../database/types.js';
import type { TaskScheduler } from '../../scheduler/task-scheduler.js';
import { GiveawayService } from './service.js';
import { createGiveawayCommands } from './commands.js';

export * from './types.js';
export * from './service.js';
export * from './commands.js';

export interface CreateGiveawayModuleOptions {
  readonly repository: IGiveawayRepository;
  readonly scheduler?: TaskScheduler;
}

export function createGiveawayModule(options: CreateGiveawayModuleOptions): ModuleDefinition {
  const service = new GiveawayService(options.repository, options.scheduler);

  return defineModule({
    id: 'giveaways',
    name: 'Riffly Giveaways',
    description:
      'Host server giveaways with interactive button entries, timed conclusions, and winner selection.',
    version: '1.0.0',
    commands: createGiveawayCommands(service),
    events: [
      {
        event: 'interactionCreate',
        execute: async (arg: unknown) => {
          const interaction = arg as Interaction;
          if (!interaction.isButton()) return;
          if (interaction.customId === 'riffly_giveaway_enter') {
            await service.handleEntryInteraction(interaction);
          }
        },
      },
    ],
  });
}

