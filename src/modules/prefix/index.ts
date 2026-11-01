import type { ModuleDefinition } from '../core/types.js';
import { PrefixService } from './service.js';
import { createPrefixCommands } from './commands.js';

export * from './service.js';
export * from './commands.js';

export function createPrefixModule(service?: PrefixService): ModuleDefinition {
  const prefixService = service ?? new PrefixService();
  const commands = createPrefixCommands(prefixService);

  return {
    id: 'prefix',
    name: 'Prefix & Template Engine',
    description:
      'Server prefix configuration, No-Prefix privilege system, and server layout templates.',
    commands,
  };
}
