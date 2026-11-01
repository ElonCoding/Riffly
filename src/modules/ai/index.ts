import { defineModule } from '../core/define-module.js';
import type { ModuleDefinition } from '../core/types.js';
import { AiService } from './service.js';
import { createAiCommands } from './commands.js';
import type { IAiProvider } from './types.js';

export * from './types.js';
export * from './service.js';
export * from './commands.js';

export interface CreateAiModuleOptions {
  readonly provider?: IAiProvider;
}

export function createAiModule(options: CreateAiModuleOptions = {}): ModuleDefinition {
  const service = new AiService(options.provider);

  return defineModule({
    id: 'ai',
    name: 'Riffly AI Assistant',
    description: 'Contextual AI assistant answering inquiries about Riffly platform features and controls.',
    version: '1.0.0',
    commands: createAiCommands(service),
  });
}

