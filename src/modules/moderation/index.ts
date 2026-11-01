import { defineModule } from '../core/define-module.js';
import type { ModuleDefinition } from '../core/types.js';
import type { IModerationRepository } from '../../database/types.js';
import { ModerationService } from './service.js';
import { createModerationCommands } from './commands.js';

export * from './types.js';
export * from './service.js';
export * from './commands.js';

export interface CreateModerationModuleOptions {
  readonly repository: IModerationRepository;
}

export const moderationSettingsSchema = {
  logChannelId: {
    type: 'string' as const,
    defaultValue: '',
  },
  dmOnSanction: {
    type: 'boolean' as const,
    defaultValue: true,
  },
  defaultPurgeLimit: {
    type: 'number' as const,
    defaultValue: 50,
    validate: (val: unknown) => typeof val === 'number' && val > 0 && val <= 100,
  },
};

export function createModerationModule(
  options: CreateModerationModuleOptions,
): ModuleDefinition<typeof moderationSettingsSchema> {
  const service = new ModerationService(options.repository);
  const commands = createModerationCommands(service);

  return defineModule({
    id: 'moderation',
    name: 'Riffly Moderation',
    description: 'Server moderation, member sanctions, and case tracking.',
    version: '1.0.0',
    settings: moderationSettingsSchema,
    commands,
  });
}

