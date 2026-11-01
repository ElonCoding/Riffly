import type { ChatInputCommandInteraction } from 'discord.js';
import type { GuildPlayerManager } from '../../player/guild-player.js';
import type { TrackResolver } from '../../provider/resolver.js';
import { defineModule } from '../core/define-module.js';
import type { ModuleDefinition } from '../core/types.js';
import { buildCommands } from '../../commands/index.js';

export interface CreateMusicModuleOptions {
  readonly playerManager: GuildPlayerManager;
  readonly resolver: TrackResolver;
}

export const musicSettingsSchema = {
  defaultVolume: {
    type: 'number' as const,
    defaultValue: 100,
    validate: (val: unknown) => typeof val === 'number' && val >= 0 && val <= 200,
  },
  maxQueueSize: {
    type: 'number' as const,
    defaultValue: 500,
    validate: (val: unknown) => typeof val === 'number' && val > 0 && val <= 5000,
  },
  disconnectTimeoutSeconds: {
    type: 'number' as const,
    defaultValue: 180,
    validate: (val: unknown) => typeof val === 'number' && val >= 0 && val <= 3600,
  },
};

/**
 * Creates the official decoupled Riffly Music Module.
 */
export function createMusicModule(
  options: CreateMusicModuleOptions,
): ModuleDefinition<typeof musicSettingsSchema> {
  const commands = buildCommands(options.playerManager, options.resolver)
    .filter((cmd) => cmd.data.name !== 'ping')
    .map((cmd) => {
      const json = cmd.data.toJSON();
      return {
        name: json.name,
        description: json.description,
        data: cmd.data,
        guildOnly: true,
        execute: (interaction: ChatInputCommandInteraction) => cmd.execute(interaction),
      };
    });

  return defineModule({
    id: 'music',
    name: 'Riffly Music',
    description: 'High-performance audio playback, queue management, and Lavalink streaming engine.',
    version: '1.0.0',
    alwaysOn: true,
    settings: musicSettingsSchema,
    commands,
  });
}

