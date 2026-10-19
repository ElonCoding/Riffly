import type { Command } from './types.js';
import { pingCommand } from './ping.js';

export * from './types.js';
export * from './ping.js';

export const commands: readonly Command[] = [pingCommand];

export const commandMap = new Map<string, Command>(
  commands.map((command) => [command.data.name, command]),
);
