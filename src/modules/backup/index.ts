import { defineModule } from '../core/define-module.js';
import type { ModuleDefinition } from '../core/types.js';
import { BackupService } from './service.js';
import { createBackupCommands } from './commands.js';

export * from './types.js';
export * from './service.js';
export * from './commands.js';

export function createBackupModule(service: BackupService = new BackupService()): ModuleDefinition {
  return defineModule({
    id: 'backup',
    name: 'Riffly Server Preservation',
    description: 'Snapshot and backup system for server layouts, channels, and roles.',
    version: '1.0.0',
    commands: createBackupCommands(service),
  });
}
