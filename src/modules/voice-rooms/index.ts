import type { VoiceState } from 'discord.js';
import { defineModule } from '../core/define-module.js';
import type { ModuleDefinition } from '../core/types.js';
import { VoiceRoomService } from './service.js';
import { createVoiceRoomCommands } from './commands.js';

export * from './types.js';
export * from './service.js';
export * from './commands.js';

export const voiceRoomSettingsSchema = {
  joinToCreateChannelId: {
    type: 'string' as const,
    defaultValue: '',
  },
  categoryId: {
    type: 'string' as const,
    defaultValue: '',
  },
  defaultUserLimit: {
    type: 'number' as const,
    defaultValue: 0,
    validate: (val: unknown) => typeof val === 'number' && val >= 0 && val <= 99,
  },
};

interface VoiceRoomModuleContext {
  readonly getSettings?: (
    guildId: string,
    moduleId: string,
  ) => Promise<{
    joinToCreateChannelId?: string;
    categoryId?: string;
    defaultUserLimit?: number;
  }>;
}

export function createVoiceRoomsModule(): ModuleDefinition<typeof voiceRoomSettingsSchema> {
  const service = new VoiceRoomService();
  const commands = createVoiceRoomCommands(service);

  return defineModule({
    id: 'voice-rooms',
    name: 'Riffly Join-To-Create Voice Rooms',
    description:
      'Dynamic temporary voice channel generation, auto-deletion on empty, and room ownership controls.',
    version: '1.0.0',
    settings: voiceRoomSettingsSchema,
    commands,
    events: [
      {
        event: 'voiceStateUpdate',
        execute: async (args: unknown, context?: unknown) => {
          const pair = Array.isArray(args) ? (args as [VoiceState, VoiceState]) : undefined;
          if (!pair || pair.length < 2) return;
          const [oldState, newState] = pair;
          const guild = newState?.guild ?? oldState?.guild;
          if (!guild) return;

          const ctx = context as VoiceRoomModuleContext | undefined;
          const settings = (await ctx?.getSettings?.(guild.id, 'voice-rooms')) ?? {
            joinToCreateChannelId: '',
            categoryId: '',
            defaultUserLimit: 0,
          };

          if (!settings.joinToCreateChannelId) return;

          await service.handleVoiceStateUpdate(oldState, newState, {
            joinToCreateChannelId: settings.joinToCreateChannelId,
            ...(settings.categoryId ? { categoryId: settings.categoryId } : {}),
            ...(settings.defaultUserLimit !== undefined
              ? { defaultUserLimit: settings.defaultUserLimit }
              : {}),
          });
        },
      },
    ],
  });
}
