import { describe, expect, it, vi } from 'vitest';
import { defineModule, ModuleValidationError } from '../../src/modules/core/define-module.js';
import { ModuleRegistry, ModuleRegistryError } from '../../src/modules/core/registry.js';
import type { ModuleDefinition } from '../../src/modules/core/types.js';

describe('Modular Core — defineModule', () => {
  it('defines a valid minimal module and returns a frozen object', () => {
    const mod = defineModule({
      id: 'general',
      name: 'General Module',
      description: 'Provides core utilities and ping commands',
    });

    expect(mod.id).toBe('general');
    expect(mod.name).toBe('General Module');
    expect(Object.isFrozen(mod)).toBe(true);
  });

  it('validates module ID constraints', () => {
    expect(() =>
      defineModule({
        id: '',
        name: 'Empty ID',
        description: 'Test',
      }),
    ).toThrow(ModuleValidationError);

    expect(() =>
      defineModule({
        id: 'Invalid_Uppercase',
        name: 'Uppercase ID',
        description: 'Test',
      }),
    ).toThrow(ModuleValidationError);

    expect(() =>
      defineModule({
        id: 'has spaces',
        name: 'Space ID',
        description: 'Test',
      }),
    ).toThrow(ModuleValidationError);

    expect(() =>
      defineModule({
        id: 'special@chars!',
        name: 'Special Chars',
        description: 'Test',
      }),
    ).toThrow(ModuleValidationError);
  });

  it('validates name and description presence', () => {
    expect(() =>
      defineModule({
        id: 'no-name',
        name: '',
        description: 'Test',
      }),
    ).toThrow(ModuleValidationError);

    expect(() =>
      defineModule({
        id: 'no-desc',
        name: 'Valid Name',
        description: '   ',
      }),
    ).toThrow(ModuleValidationError);
  });

  it('validates dependency declarations', () => {
    // Valid dependency
    const valid = defineModule({
      id: 'music-lyrics',
      name: 'Lyrics',
      description: 'Lyrics addon',
      dependencies: ['music-core'],
    });
    expect(valid.dependencies).toEqual(['music-core']);

    // Self dependency rejected
    expect(() =>
      defineModule({
        id: 'self-dep',
        name: 'Self Dep',
        description: 'Test',
        dependencies: ['self-dep'],
      }),
    ).toThrow(ModuleValidationError);

    // Duplicate dependency rejected
    expect(() =>
      defineModule({
        id: 'dup-dep',
        name: 'Duplicate Dep',
        description: 'Test',
        dependencies: ['core-dep', 'core-dep'],
      }),
    ).toThrow(ModuleValidationError);
  });

  it('validates settings schemas and custom validators', () => {
    const validMod = defineModule({
      id: 'automod',
      name: 'AutoMod',
      description: 'Automated server moderation',
      settings: {
        maxWarnings: {
          type: 'number',
          defaultValue: 3,
          validate: (val) => typeof val === 'number' && val > 0,
        },
        enabledChannels: {
          type: 'string[]',
          defaultValue: [],
        },
      },
    });

    expect(validMod.settings?.['maxWarnings']?.defaultValue).toBe(3);

    // Invalid setting type
    expect(() =>
      defineModule({
        id: 'bad-setting',
        name: 'Bad Setting',
        description: 'Test',
        settings: {
          foo: {
            // @ts-expect-error Testing invalid runtime type
            type: 'invalid-type',
            defaultValue: 123,
          },
        },
      }),
    ).toThrow(ModuleValidationError);

    // Missing default value
    expect(() =>
      defineModule({
        id: 'no-default',
        name: 'No Default',
        description: 'Test',
        settings: {
          foo: {
            type: 'number',
            defaultValue: undefined as unknown as number,
          },
        },
      }),
    ).toThrow(ModuleValidationError);

    // Validator rejecting default value
    expect(() =>
      defineModule({
        id: 'failing-validator',
        name: 'Failing Validator',
        description: 'Test',
        settings: {
          threshold: {
            type: 'number',
            defaultValue: -5,
            validate: (val: unknown) =>
              typeof val === 'number' && val >= 0 ? true : 'Threshold must be non-negative',
          },
        },
      }),
    ).toThrow(ModuleValidationError);
  });

  it('validates command definitions', () => {
    // Valid command
    const mod = defineModule({
      id: 'moderation',
      name: 'Moderation',
      description: 'Moderation commands',
      commands: [
        {
          name: 'ban',
          description: 'Ban a member',
          execute: async () => {},
        },
      ],
    });
    expect(mod.commands?.length).toBe(1);

    // Duplicate command name in same module
    expect(() =>
      defineModule({
        id: 'dup-cmd',
        name: 'Dup Cmd',
        description: 'Test',
        commands: [
          {
            name: 'kick',
            description: 'Kick a member',
            execute: async () => {},
          },
          {
            name: 'kick',
            description: 'Duplicate kick',
            execute: async () => {},
          },
        ],
      }),
    ).toThrow(ModuleValidationError);

    // Invalid command name
    expect(() =>
      defineModule({
        id: 'bad-cmd-name',
        name: 'Bad Command Name',
        description: 'Test',
        commands: [
          {
            name: 'INVALID COMMAND!',
            description: 'Test description',
            execute: async () => {},
          },
        ],
      }),
    ).toThrow(ModuleValidationError);

    // Missing execute function
    expect(() =>
      defineModule({
        id: 'no-exec',
        name: 'No Exec',
        description: 'Test',
        commands: [
          {
            name: 'kick',
            description: 'Kick member',
            // @ts-expect-error Testing runtime invalid execute
            execute: 'not a function',
          },
        ],
      }),
    ).toThrow(ModuleValidationError);
  });

  it('validates event listeners and background tasks', () => {
    // Valid events and tasks
    const mod = defineModule({
      id: 'logging',
      name: 'Audit Logging',
      description: 'Logs server events',
      events: [
        {
          event: 'messageDelete',
          priority: 50,
          execute: async () => {},
        },
      ],
      tasks: [
        {
          name: 'cleanup_logs',
          intervalMs: 60000,
          execute: async () => {},
        },
      ],
    });
    expect(mod.events?.length).toBe(1);
    expect(mod.tasks?.length).toBe(1);

    // Invalid event priority
    expect(() =>
      defineModule({
        id: 'bad-evt-priority',
        name: 'Bad Priority',
        description: 'Test',
        events: [
          {
            event: 'guildMemberAdd',
            priority: NaN,
            execute: async () => {},
          },
        ],
      }),
    ).toThrow(ModuleValidationError);

    // Invalid task intervalMs
    expect(() =>
      defineModule({
        id: 'bad-task-interval',
        name: 'Bad Task',
        description: 'Test',
        tasks: [
          {
            name: 'sync',
            intervalMs: -100,
            execute: async () => {},
          },
        ],
      }),
    ).toThrow(ModuleValidationError);
  });
});

describe('Modular Core — ModuleRegistry', () => {
  it('registers and retrieves modules', () => {
    const registry = new ModuleRegistry();
    const mod = defineModule({
      id: 'core-utils',
      name: 'Core Utilities',
      description: 'Core platform utilities',
    });

    registry.register(mod);
    expect(registry.has('core-utils')).toBe(true);
    expect(registry.get('core-utils')?.name).toBe('Core Utilities');
    expect(registry.getAll()).toHaveLength(1);

    // Duplicate registration rejected
    expect(() => registry.register(mod)).toThrow(ModuleRegistryError);
  });

  it('resolves topological dependency order accurately', () => {
    const registry = new ModuleRegistry();

    const coreMod = defineModule({
      id: 'riffly-core',
      name: 'Riffly Core',
      description: 'Base core module',
    });

    const musicMod = defineModule({
      id: 'riffly-music',
      name: 'Riffly Music',
      description: 'Music player subsystem',
      dependencies: ['riffly-core'],
    });

    const playlistMod = defineModule({
      id: 'riffly-playlist',
      name: 'Riffly Playlists',
      description: 'Playlist manager',
      dependencies: ['riffly-music'],
    });

    // Register in mixed order
    registry.register(playlistMod);
    registry.register(coreMod);
    registry.register(musicMod);

    const order = registry.getDependencyOrder().map((m) => m.id);
    expect(order).toEqual(['riffly-core', 'riffly-music', 'riffly-playlist']);
  });

  it('throws descriptive error on missing dependencies', () => {
    const registry = new ModuleRegistry();
    const mod = defineModule({
      id: 'ticket-system',
      name: 'Tickets',
      description: 'Support tickets',
      dependencies: ['missing-auth-module'],
    });

    registry.register(mod);
    expect(() => registry.getDependencyOrder()).toThrow(
      /Missing dependency: Module "ticket-system" requires "missing-auth-module"/,
    );
  });

  it('detects circular dependencies and throws descriptive error', () => {
    const registry = new ModuleRegistry();

    const modA = defineModule({
      id: 'module-a',
      name: 'A',
      description: 'A',
      dependencies: ['module-b'],
    });

    const modB = defineModule({
      id: 'module-b',
      name: 'B',
      description: 'B',
      dependencies: ['module-a'],
    });

    registry.register(modA);
    registry.register(modB);

    expect(() => registry.getDependencyOrder()).toThrow(/Circular dependency detected/);
  });

  it('executes loadAll and unloadAll lifecycle hooks in dependency order', async () => {
    const registry = new ModuleRegistry();
    const lifecycleLog: string[] = [];

    const coreMod = defineModule({
      id: 'core',
      name: 'Core',
      description: 'Core',
      onLoad: () => {
        lifecycleLog.push('load:core');
      },
      onUnload: () => {
        lifecycleLog.push('unload:core');
      },
    });

    const extMod = defineModule({
      id: 'ext',
      name: 'Extension',
      description: 'Extension',
      dependencies: ['core'],
      onLoad: () => {
        lifecycleLog.push('load:ext');
      },
      onUnload: () => {
        lifecycleLog.push('unload:ext');
      },
    });

    registry.register(extMod);
    registry.register(coreMod);

    await registry.loadAll();
    expect(registry.isReady()).toBe(true);
    expect(lifecycleLog).toEqual(['load:core', 'load:ext']);

    await registry.unloadAll();
    expect(registry.isReady()).toBe(false);
    expect(lifecycleLog).toEqual(['load:core', 'load:ext', 'unload:ext', 'unload:core']);
  });

  it('manages per-guild module enable and disable state with safety guards', async () => {
    const registry = new ModuleRegistry();
    const enableLog: string[] = [];

    const base = defineModule({
      id: 'base-security',
      name: 'Security Base',
      description: 'Security baseline',
      onGuildEnable: (guildId) => {
        enableLog.push(`enable:base:${guildId}`);
      },
      onGuildDisable: (guildId) => {
        enableLog.push(`disable:base:${guildId}`);
      },
    });

    const antiraid = defineModule({
      id: 'anti-raid',
      name: 'Anti-Raid',
      description: 'Raid prevention',
      dependencies: ['base-security'],
      onGuildEnable: (guildId) => {
        enableLog.push(`enable:antiraid:${guildId}`);
      },
      onGuildDisable: (guildId) => {
        enableLog.push(`disable:antiraid:${guildId}`);
      },
    });

    const alwaysOn = defineModule({
      id: 'core-system',
      name: 'Core System',
      description: 'Always on system',
      alwaysOn: true,
    });

    registry.registerMany([base, antiraid, alwaysOn]);

    const guildId = 'guild-100';

    // Disabling base-security when anti-raid is enabled (or by default enabled) fails
    await expect(registry.disableModule(guildId, 'base-security')).rejects.toThrow(
      /because enabled module "anti-raid" depends on it/,
    );

    // Disabling always-on module throws
    await expect(registry.disableModule(guildId, 'core-system')).rejects.toThrow(
      /Cannot disable always-on module/,
    );

    // Disable anti-raid first
    await registry.disableModule(guildId, 'anti-raid');
    expect(registry.isModuleEnabled(guildId, 'anti-raid')).toBe(false);
    expect(enableLog).toContain(`disable:antiraid:${guildId}`);

    // Now disabling base-security succeeds
    await registry.disableModule(guildId, 'base-security');
    expect(registry.isModuleEnabled(guildId, 'base-security')).toBe(false);

    // Re-enabling anti-raid recursively enables base-security
    await registry.enableModule(guildId, 'anti-raid');
    expect(registry.isModuleEnabled(guildId, 'base-security')).toBe(true);
    expect(registry.isModuleEnabled(guildId, 'anti-raid')).toBe(true);
  });

  it('handles default settings fallback and per-guild configuration overrides', () => {
    const registry = new ModuleRegistry();

    const mod = defineModule({
      id: 'welcome',
      name: 'Welcome Bot',
      description: 'Greets new members',
      settings: {
        channelId: {
          type: 'string',
          defaultValue: 'default-channel',
        },
        sendDm: {
          type: 'boolean',
          defaultValue: false,
        },
        maxAttempts: {
          type: 'number',
          defaultValue: 3,
          validate: (val) => typeof val === 'number' && val > 0,
        },
      },
    });

    registry.register(mod);

    // Defaults before any override
    const defaults = registry.getSettings<{
      channelId: string;
      sendDm: boolean;
      maxAttempts: number;
    }>('guild-1', 'welcome');
    expect(defaults).toEqual({
      channelId: 'default-channel',
      sendDm: false,
      maxAttempts: 3,
    });

    // Apply per-guild overrides
    registry.setSettings('guild-1', 'welcome', {
      channelId: 'welcome-lounge',
      sendDm: true,
    });

    const guild1Settings = registry.getSettings<{
      channelId: string;
      sendDm: boolean;
      maxAttempts: number;
    }>('guild-1', 'welcome');

    expect(guild1Settings.channelId).toBe('welcome-lounge');
    expect(guild1Settings.sendDm).toBe(true);
    expect(guild1Settings.maxAttempts).toBe(3); // Preserved fallback default

    // Guild-2 still sees defaults
    const guild2Settings = registry.getSettings<{ channelId: string }>('guild-2', 'welcome');
    expect(guild2Settings.channelId).toBe('default-channel');

    // Setting invalid value throws validation error
    expect(() =>
      registry.setSettings('guild-1', 'welcome', {
        maxAttempts: -1,
      }),
    ).toThrow(/Invalid value for setting "maxAttempts"/);
  });

  it('queries slash commands scoped to guild enablement', async () => {
    const registry = new ModuleRegistry();

    const modA: ModuleDefinition = defineModule({
      id: 'mod-a',
      name: 'Module A',
      description: 'Commands for A',
      commands: [
        {
          name: 'command-a',
          description: 'Desc A',
          execute: vi.fn(),
        },
      ],
    });

    const modB: ModuleDefinition = defineModule({
      id: 'mod-b',
      name: 'Module B',
      description: 'Commands for B',
      commands: [
        {
          name: 'command-b',
          description: 'Desc B',
          execute: vi.fn(),
        },
      ],
    });

    registry.registerMany([modA, modB]);

    const guildId = 'guild-55';
    expect(registry.getCommandsForGuild(guildId).map((c) => c.name)).toEqual([
      'command-a',
      'command-b',
    ]);

    // Disable Module B in guild-55
    await registry.disableModule(guildId, 'mod-b');
    expect(registry.getCommandsForGuild(guildId).map((c) => c.name)).toEqual(['command-a']);

    // getAllCommands returns both
    expect(registry.getAllCommands().map((c) => c.name)).toEqual(['command-a', 'command-b']);
  });
});
