import type { Client, TextChannel } from 'discord.js';
import { defineModule } from '../core/define-module.js';
import type { ModuleDefinition } from '../core/types.js';
import { createUtilityCommands } from './commands.js';
import type { UtilityModuleOptions } from './types.js';

export * from './types.js';
export * from './commands.js';

export function createUtilityModule(
  options: UtilityModuleOptions = {},
  client?: Client,
): ModuleDefinition {
  if (options.scheduler && client) {
    options.scheduler.registerHandler<{
      userId?: string;
      channelId?: string;
      reason?: string;
    }>('reminder', async (payload) => {
      const { userId, channelId, reason } = payload;

      if (!userId) return;

      try {
        if (channelId) {
          const channel = (await client.channels.fetch(channelId).catch(() => null)) as TextChannel | null;
          if (channel && 'send' in channel) {
            await channel.send({
              content: `⏰ <@${userId}>, here is your reminder: **${reason ?? 'No reason provided'}**`,
            });
            return;
          }
        }

        const user = await client.users.fetch(userId).catch(() => null);
        if (user) {
          await user.send({
            content: `⏰ Reminder: **${reason ?? 'No reason provided'}**`,
          });
        }
      } catch {
        // Notification delivery error handled gracefully
      }
    });
  }

  return defineModule({
    id: 'utility',
    name: 'Riffly Community Utilities',
    description:
      'Member information, server statistics, avatars, polls, and reminder scheduling.',
    version: '1.0.0',
    commands: createUtilityCommands(options.scheduler),
  });
}
