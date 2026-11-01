import type { ModuleDefinition } from '../core/types.js';
import { createFunCommands } from './commands.js';

export * from './commands.js';

export function createFunModule(): ModuleDefinition {
  const commands = createFunCommands();

  return {
    id: 'fun',
    name: 'Fun & Games',
    description: 'Anime roleplay interactions, image filters, games, and entertainment.',
    commands,
  };
}
