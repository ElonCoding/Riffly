import { defineModule } from '../core/define-module.js';
import type { ModuleDefinition } from '../core/types.js';
import { VerificationService } from './service.js';
import { createVerificationCommands } from './commands.js';

export * from './types.js';
export * from './service.js';
export * from './commands.js';

export const verificationSettingsSchema = {
  verifiedRoleId: {
    type: 'string' as const,
    defaultValue: '',
  },
  autoRoleId: {
    type: 'string' as const,
    defaultValue: '',
  },
  welcomeChannelId: {
    type: 'string' as const,
    defaultValue: '',
  },
  goodbyeChannelId: {
    type: 'string' as const,
    defaultValue: '',
  },
  welcomeMessage: {
    type: 'string' as const,
    defaultValue: 'Welcome {user} to {server}!',
  },
  goodbyeMessage: {
    type: 'string' as const,
    defaultValue: '{user} has left {server}. Farewell!',
  },
};

export function createVerificationModule(): ModuleDefinition<typeof verificationSettingsSchema> {
  const service = new VerificationService();
  const commands = createVerificationCommands(service);

  return defineModule({
    id: 'verification',
    name: 'Riffly Verification & Onboarding',
    description: 'Server gatekeeping, button verification, auto-roles, and welcome messages.',
    version: '1.0.0',
    settings: verificationSettingsSchema,
    commands,
  });
}
