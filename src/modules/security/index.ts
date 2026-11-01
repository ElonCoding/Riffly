import type { ModuleDefinition } from '../core/types.js';
import { PrismaSecurityRepository } from '../../database/repositories/security-repository.js';
import { SecurityService } from './service.js';
import { createSecurityCommands } from './commands.js';

export * from './service.js';
export * from './commands.js';

export function createSecurityModule(service?: SecurityService): ModuleDefinition {
  const securityService = service ?? new SecurityService(new PrismaSecurityRepository());
  const commands = createSecurityCommands(securityService);

  return {
    id: 'security',
    name: 'Security Engine',
    description: 'Comprehensive Anti-Nuke, Anti-Raid, and AutoMod defenses.',
    commands,
  };
}
