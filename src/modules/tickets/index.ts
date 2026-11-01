import { defineModule } from '../core/define-module.js';
import type { ModuleDefinition } from '../core/types.js';
import type { ITicketRepository } from '../../database/types.js';
import { TicketService } from './service.js';
import { createTicketCommands } from './commands.js';

export * from './types.js';
export * from './service.js';
export * from './commands.js';

export interface CreateTicketsModuleOptions {
  readonly repository: ITicketRepository;
}

export const ticketSettingsSchema = {
  supportRoleId: {
    type: 'string' as const,
    defaultValue: '',
  },
  transcriptChannelId: {
    type: 'string' as const,
    defaultValue: '',
  },
  maxOpenTicketsPerUser: {
    type: 'number' as const,
    defaultValue: 3,
    validate: (val: unknown) => typeof val === 'number' && val > 0 && val <= 10,
  },
};

export function createTicketsModule(
  options: CreateTicketsModuleOptions,
): ModuleDefinition<typeof ticketSettingsSchema> {
  const service = new TicketService(options.repository);
  const commands = createTicketCommands(service);

  return defineModule({
    id: 'tickets',
    name: 'Riffly Support Tickets',
    description: 'Private support channels, transcripts, assignment claims, and resolution tracking.',
    version: '1.0.0',
    settings: ticketSettingsSchema,
    commands,
  });
}
