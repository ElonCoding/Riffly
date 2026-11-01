import type { ModuleDefinition } from '../core/types.js';
import { PrismaCommunityRepository } from '../../database/repositories/community-repository.js';
import { CommunityService } from './service.js';
import { createCommunityCommands } from './commands.js';

export * from './service.js';
export * from './commands.js';

export function createCommunityModule(service?: CommunityService): ModuleDefinition {
  const communityService = service ?? new CommunityService(new PrismaCommunityRepository());
  const commands = createCommunityCommands(communityService);

  return {
    id: 'community',
    name: 'Community Engine',
    description:
      'AutoRoles, Reaction Roles, Vanity Roles, Clownboard, Counting, AutoResponders, Timers, Bumpers, Social Alerts, and Booster Roles.',
    commands,
  };
}
