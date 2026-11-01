import { defineModule } from '../core/define-module.js';
import type { ModuleDefinition } from '../core/types.js';
import type { IEconomyRepository } from '../../database/types.js';
import { createEconomyCommands } from './commands.js';

export * from './types.js';
export * from './commands.js';

export interface CreateEconomyModuleOptions {
  readonly repository: IEconomyRepository;
  readonly currencySymbol?: string;
}

export function createEconomyModule(options: CreateEconomyModuleOptions): ModuleDefinition {
  return defineModule({
    id: 'economy',
    name: 'Riffly Virtual Economy',
    description:
      'Wallets, bank accounts, daily claims, work shifts, coin transfers, and wealth leaderboards.',
    version: '1.0.0',
    commands: createEconomyCommands(options.repository, options.currencySymbol ?? '🪙'),
  });
}
