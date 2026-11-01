import type { Client } from 'discord.js';
import type {
  CommandDefinition,
  ModuleContext,
  ModuleDefinition,
  ModuleLogger,
  ModuleSettings,
  ModuleSettingsSchema,
  SettingField,
} from './types.js';

/**
 * Error thrown during module registry, dependency resolution, or lifecycle execution.
 */
export class ModuleRegistryError extends Error {
  public readonly moduleId?: string | undefined;

  constructor(message: string, moduleId?: string) {
    super(moduleId ? `[ModuleRegistry:${moduleId}] ${message}` : `[ModuleRegistry] ${message}`);
    this.name = 'ModuleRegistryError';
    this.moduleId = moduleId;
    Object.setPrototypeOf(this, ModuleRegistryError.prototype);
  }
}

/**
 * Creates a default structured logger for a module.
 */
export function createDefaultModuleLogger(moduleId: string): ModuleLogger {
  const prefix = `[Module:${moduleId}]`;
  return {
    info: (msg: string, ...args: unknown[]) => console.log(`${prefix} ${msg}`, ...args),
    warn: (msg: string, ...args: unknown[]) => console.warn(`${prefix} ${msg}`, ...args),
    error: (msg: string, ...args: unknown[]) => console.error(`${prefix} ${msg}`, ...args),
    debug: (msg: string, ...args: unknown[]) => console.debug(`${prefix} ${msg}`, ...args),
  };
}

export interface ModuleRegistryOptions {
  readonly client?: Client | undefined;
  readonly defaultGuildModuleEnabled?: boolean | undefined;
}

/**
 * Central registry managing module declarations, dependency graphs,
 * per-guild toggle states, lifecycle dispatch, and settings inheritance.
 */
export class ModuleRegistry {
  private readonly modules = new Map<string, ModuleDefinition>();
  private readonly guildEnabledStates = new Map<string, Map<string, boolean>>();
  private readonly guildSettingsOverrides = new Map<string, Map<string, Record<string, unknown>>>();
  private readonly client: Client | undefined;
  private readonly defaultGuildModuleEnabled: boolean;
  private isLoaded = false;

  constructor(options: ModuleRegistryOptions = {}) {
    this.client = options.client;
    this.defaultGuildModuleEnabled = options.defaultGuildModuleEnabled ?? true;
  }

  /**
   * Registers a single module with the platform.
   */
  public register<S extends ModuleSettingsSchema = ModuleSettingsSchema>(module: ModuleDefinition<S>): this {
    if (!module || typeof module.id !== 'string') {
      throw new ModuleRegistryError('Invalid module definition provided.');
    }

    if (this.modules.has(module.id)) {
      throw new ModuleRegistryError(`Module with ID "${module.id}" is already registered.`, module.id);
    }

    this.modules.set(module.id, module as ModuleDefinition);
    return this;
  }

  /**
   * Registers multiple modules in sequence.
   */
  public registerMany(modules: readonly ModuleDefinition[]): this {
    for (const mod of modules) {
      this.register(mod);
    }
    return this;
  }

  /**
   * Unregisters a module and executes its onUnload hook if currently loaded.
   */
  public async unregister(moduleId: string): Promise<void> {
    const mod = this.modules.get(moduleId);
    if (!mod) {
      return;
    }

    // Ensure no other registered module depends on this one
    for (const other of this.modules.values()) {
      if (other.dependencies?.includes(moduleId)) {
        throw new ModuleRegistryError(
          `Cannot unregister module "${moduleId}" because module "${other.id}" depends on it.`,
          moduleId,
        );
      }
    }

    if (this.isLoaded && mod.onUnload) {
      const ctx = this.createContext(moduleId);
      await mod.onUnload(ctx);
    }

    this.modules.delete(moduleId);

    // Clean up per-guild states for this module
    for (const states of this.guildEnabledStates.values()) {
      states.delete(moduleId);
    }
    for (const settings of this.guildSettingsOverrides.values()) {
      settings.delete(moduleId);
    }
  }

  /**
   * Retrieves a registered module definition by ID.
   */
  public get<S extends ModuleSettingsSchema = ModuleSettingsSchema>(
    moduleId: string,
  ): ModuleDefinition<S> | undefined {
    return this.modules.get(moduleId) as ModuleDefinition<S> | undefined;
  }

  /**
   * Checks if a module is registered.
   */
  public has(moduleId: string): boolean {
    return this.modules.has(moduleId);
  }

  /**
   * Returns all registered modules.
   */
  public getAll(): readonly ModuleDefinition[] {
    return Array.from(this.modules.values());
  }

  /**
   * Resolves registered modules into topological dependency order.
   * If module A depends on module B, module B will appear before module A in the returned array.
   */
  public getDependencyOrder(): readonly ModuleDefinition[] {
    const sorted: ModuleDefinition[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (modId: string, dependencyPath: string[]): void => {
      if (visiting.has(modId)) {
        const cycle = [...dependencyPath, modId].join(' -> ');
        throw new ModuleRegistryError(`Circular dependency detected: ${cycle}`, modId);
      }

      if (visited.has(modId)) {
        return;
      }

      const mod = this.modules.get(modId);
      if (!mod) {
        const parentId = dependencyPath[dependencyPath.length - 1];
        throw new ModuleRegistryError(
          `Missing dependency: Module "${parentId ?? 'unknown'}" requires "${modId}", but "${modId}" is not registered.`,
          modId,
        );
      }

      visiting.add(modId);

      const deps = mod.dependencies ?? [];
      for (const depId of deps) {
        visit(depId, [...dependencyPath, modId]);
      }

      visiting.delete(modId);
      visited.add(modId);
      sorted.push(mod);
    };

    for (const modId of this.modules.keys()) {
      if (!visited.has(modId)) {
        visit(modId, []);
      }
    }

    return sorted;
  }

  /**
   * Loads all registered modules in topological dependency order.
   */
  public async loadAll(
    contextFactory?: (mod: ModuleDefinition) => ModuleContext,
  ): Promise<void> {
    const ordered = this.getDependencyOrder();

    for (const mod of ordered) {
      if (mod.onLoad) {
        const ctx = contextFactory ? contextFactory(mod) : this.createContext(mod.id);
        await mod.onLoad(ctx);
      }
    }

    this.isLoaded = true;
  }

  /**
   * Unloads all registered modules in reverse dependency order.
   */
  public async unloadAll(): Promise<void> {
    const ordered = [...this.getDependencyOrder()].reverse();

    for (const mod of ordered) {
      if (mod.onUnload) {
        const ctx = this.createContext(mod.id);
        await mod.onUnload(ctx);
      }
    }

    this.isLoaded = false;
  }

  /**
   * Checks whether the registry has completed loadAll.
   */
  public isReady(): boolean {
    return this.isLoaded;
  }

  /**
   * Checks if a module is enabled for a specific guild.
   */
  public isModuleEnabled(guildId: string, moduleId: string): boolean {
    const mod = this.modules.get(moduleId);
    if (!mod) {
      return false;
    }

    // Always-on modules cannot be disabled
    if (mod.alwaysOn) {
      return true;
    }

    const guildStates = this.guildEnabledStates.get(guildId);
    if (guildStates?.has(moduleId)) {
      return guildStates.get(moduleId) === true;
    }

    return this.defaultGuildModuleEnabled;
  }

  /**
   * Enables a module for a guild, recursively ensuring all dependencies are also enabled.
   */
  public async enableModule(guildId: string, moduleId: string): Promise<void> {
    const mod = this.modules.get(moduleId);
    if (!mod) {
      throw new ModuleRegistryError(`Cannot enable unregistered module "${moduleId}".`, moduleId);
    }

    if (this.isModuleEnabled(guildId, moduleId)) {
      return;
    }

    // Recursively enable required dependencies
    if (mod.dependencies && mod.dependencies.length > 0) {
      for (const depId of mod.dependencies) {
        if (!this.isModuleEnabled(guildId, depId)) {
          await this.enableModule(guildId, depId);
        }
      }
    }

    let guildStates = this.guildEnabledStates.get(guildId);
    if (!guildStates) {
      guildStates = new Map<string, boolean>();
      this.guildEnabledStates.set(guildId, guildStates);
    }
    guildStates.set(moduleId, true);

    const ctx = this.createContext(moduleId);
    if (mod.onGuildEnable) {
      await mod.onGuildEnable(guildId, ctx);
    }
    if (mod.onEnable) {
      await mod.onEnable(ctx);
    }
  }

  /**
   * Disables a module for a guild.
   * Throws if the module is always-on or if another currently enabled module depends on it.
   */
  public async disableModule(guildId: string, moduleId: string): Promise<void> {
    const mod = this.modules.get(moduleId);
    if (!mod) {
      throw new ModuleRegistryError(`Cannot disable unregistered module "${moduleId}".`, moduleId);
    }

    if (mod.alwaysOn) {
      throw new ModuleRegistryError(
        `Cannot disable always-on module "${moduleId}" in guild "${guildId}".`,
        moduleId,
      );
    }

    if (!this.isModuleEnabled(guildId, moduleId)) {
      return;
    }

    // Check if any other enabled module in this guild depends on this module
    for (const other of this.modules.values()) {
      if (
        other.id !== moduleId &&
        this.isModuleEnabled(guildId, other.id) &&
        other.dependencies?.includes(moduleId)
      ) {
        throw new ModuleRegistryError(
          `Cannot disable module "${moduleId}" in guild "${guildId}" because enabled module "${other.id}" depends on it.`,
          moduleId,
        );
      }
    }

    let guildStates = this.guildEnabledStates.get(guildId);
    if (!guildStates) {
      guildStates = new Map<string, boolean>();
      this.guildEnabledStates.set(guildId, guildStates);
    }
    guildStates.set(moduleId, false);

    const ctx = this.createContext(moduleId);
    if (mod.onGuildDisable) {
      await mod.onGuildDisable(guildId, ctx);
    }
    if (mod.onDisable) {
      await mod.onDisable(ctx);
    }
  }

  /**
   * Returns all modules enabled for a specific guild in dependency order.
   */
  public getEnabledModules(guildId: string): readonly ModuleDefinition[] {
    const ordered = this.getDependencyOrder();
    return ordered.filter((mod) => this.isModuleEnabled(guildId, mod.id));
  }

  /**
   * Extracts default settings values from a module's settings schema.
   */
  public getDefaultSettings<S extends ModuleSettingsSchema = ModuleSettingsSchema>(
    moduleId: string,
  ): ModuleSettings<S> {
    const mod = this.modules.get(moduleId);
    if (!mod) {
      throw new ModuleRegistryError(`Module "${moduleId}" not registered.`, moduleId);
    }

    const result: Record<string, unknown> = {};
    if (mod.settings) {
      for (const [key, field] of Object.entries(mod.settings as Record<string, SettingField<unknown>>)) {
        result[key] = field.defaultValue;
      }
    }

    return result as ModuleSettings<S>;
  }

  /**
   * Retrieves effective settings for a module in a guild (schema defaults merged with guild overrides).
   */
  public getSettings<T = Record<string, unknown>>(guildId: string, moduleId: string): T {
    const defaults = this.getDefaultSettings(moduleId);
    const overrides = this.guildSettingsOverrides.get(guildId)?.get(moduleId);

    if (!overrides) {
      return { ...defaults } as T;
    }

    return { ...defaults, ...overrides } as T;
  }

  /**
   * Updates settings for a module in a guild, validating against schema rules.
   */
  public setSettings(guildId: string, moduleId: string, patch: Record<string, unknown>): void {
    const mod = this.modules.get(moduleId);
    if (!mod) {
      throw new ModuleRegistryError(`Module "${moduleId}" not registered.`, moduleId);
    }

    if (mod.settings) {
      const schema = mod.settings as Record<string, SettingField<unknown>>;
      for (const [key, value] of Object.entries(patch)) {
        const field = schema[key];
        if (field && typeof field.validate === 'function') {
          const valid = field.validate(value);
          if (valid === false || typeof valid === 'string') {
            const err = typeof valid === 'string' ? valid : `Invalid value for setting "${key}".`;
            throw new ModuleRegistryError(err, moduleId);
          }
        }
      }
    }

    let guildMap = this.guildSettingsOverrides.get(guildId);
    if (!guildMap) {
      guildMap = new Map<string, Record<string, unknown>>();
      this.guildSettingsOverrides.set(guildId, guildMap);
    }

    const current = guildMap.get(moduleId) ?? {};
    guildMap.set(moduleId, { ...current, ...patch });
  }

  /**
   * Retrieves all slash commands from modules enabled in a specific guild.
   */
  public getCommandsForGuild(guildId: string): readonly CommandDefinition[] {
    const enabled = this.getEnabledModules(guildId);
    const commands: CommandDefinition[] = [];
    const seenNames = new Set<string>();

    for (const mod of enabled) {
      if (mod.commands) {
        for (const cmd of mod.commands) {
          if (!seenNames.has(cmd.name)) {
            seenNames.add(cmd.name);
            commands.push(cmd);
          }
        }
      }
    }

    return commands;
  }

  /**
   * Returns all slash commands defined across all registered modules.
   */
  public getAllCommands(): readonly CommandDefinition[] {
    const commands: CommandDefinition[] = [];
    const seenNames = new Set<string>();

    for (const mod of this.modules.values()) {
      if (mod.commands) {
        for (const cmd of mod.commands) {
          if (!seenNames.has(cmd.name)) {
            seenNames.add(cmd.name);
            commands.push(cmd);
          }
        }
      }
    }

    return commands;
  }

  /**
   * Creates a ModuleContext instance for a given module.
   */
  public createContext<S extends ModuleSettingsSchema = ModuleSettingsSchema>(
    moduleId: string,
  ): ModuleContext<S> {
    const logger = createDefaultModuleLogger(moduleId);

    return {
      client: this.client,
      moduleId,
      logger,
      getSettings: (guildId?: string) => {
        if (guildId) {
          return this.getSettings<ModuleSettings<S>>(guildId, moduleId);
        }
        return this.getDefaultSettings<S>(moduleId);
      },
      updateSettings: (guildId: string, patch: Partial<ModuleSettings<S>>) => {
        this.setSettings(guildId, moduleId, patch);
      },
    };
  }
}
