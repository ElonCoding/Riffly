import type {
  ChatInputCommandInteraction,
  Client,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
  SlashCommandBuilder,
} from 'discord.js';

/**
 * Supported primitive and semantic types for module configuration settings.
 */
export type SettingType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'string[]'
  | 'channel'
  | 'role'
  | 'json';

/**
 * Definition of an individual configurable setting field.
 */
export interface SettingField<T = unknown> {
  readonly type: SettingType;
  readonly defaultValue: T;
  readonly description?: string;
  readonly required?: boolean;
  readonly validate?: (value: T) => boolean | string;
}

/**
 * Schema defining the configurable settings of a module.
 */
export type ModuleSettingsSchema = Readonly<Record<string, SettingField<unknown>>>;

/**
 * Type-level utility to infer strongly-typed settings object from a schema.
 */
export type InferSettings<S extends ModuleSettingsSchema> = {
  readonly [K in keyof S]: S[K] extends SettingField<infer T> ? T : unknown;
};

/**
 * Alias for InferSettings.
 */
export type ModuleSettings<S extends ModuleSettingsSchema> = InferSettings<S>;

/**
 * Structured logger scoped to a module instance.
 */
export interface ModuleLogger {
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
}

/**
 * Runtime execution context provided to modules and lifecycle hooks.
 */
export interface ModuleContext<S extends ModuleSettingsSchema = ModuleSettingsSchema> {
  readonly client?: Client | undefined;
  readonly moduleId: string;
  readonly logger: ModuleLogger;
  getSettings(guildId?: string): Promise<ModuleSettings<S>> | ModuleSettings<S>;
  updateSettings(guildId: string, patch: Partial<ModuleSettings<S>>): Promise<void> | void;
  emit?(event: string, ...args: unknown[]): void;
}

/**
 * Lifecycle hooks supported by a modular platform component.
 */
export interface ModuleLifecycleHooks<S extends ModuleSettingsSchema = ModuleSettingsSchema> {
  readonly onLoad?: (ctx: ModuleContext<S>) => Promise<void> | void;
  readonly onUnload?: (ctx: ModuleContext<S>) => Promise<void> | void;
  readonly onGuildEnable?: (guildId: string, ctx: ModuleContext<S>) => Promise<void> | void;
  readonly onGuildDisable?: (guildId: string, ctx: ModuleContext<S>) => Promise<void> | void;
  readonly onEnable?: (ctx: ModuleContext<S>) => Promise<void> | void;
  readonly onDisable?: (ctx: ModuleContext<S>) => Promise<void> | void;
}

/**
 * Slash command definition attached to a module.
 */
export interface CommandDefinition {
  readonly name: string;
  readonly description: string;
  readonly data?:
    | {
        readonly name: string;
        readonly toJSON: () => RESTPostAPIChatInputApplicationCommandsJSONBody;
      }
    | SlashCommandBuilder
    | undefined;
  readonly guildOnly?: boolean | undefined;
  readonly defaultMemberPermissions?: bigint | string | null | undefined;
  readonly execute: (
    interaction: ChatInputCommandInteraction,
    context?: unknown,
  ) => Promise<void> | void;
}

/**
 * Standard numeric priority levels for module event listeners.
 * Higher priority values execute first.
 */
export const EventPriorities = {
  MONITOR: -100,
  LOW: -50,
  NORMAL: 0,
  HIGH: 50,
  HIGHEST: 100,
  CRITICAL: 200,
} as const;

export type EventPriority = number;

/**
 * Event listener registration within a module.
 */
export interface EventListenerDefinition<E = unknown> {
  readonly event: string;
  readonly priority?: number | undefined;
  readonly once?: boolean | undefined;
  readonly filter?: ((args: E, guildId?: string) => boolean | Promise<boolean>) | undefined;
  readonly execute: (args: E, context?: unknown) => Promise<void> | void;
}

/**
 * Scheduled cron or interval task definition within a module.
 */
export interface ScheduledTaskDefinition {
  readonly name: string;
  readonly cron?: string | undefined;
  readonly intervalMs?: number | undefined;
  readonly execute: (context?: unknown) => Promise<void> | void;
}

/**
 * Complete declarative module contract for Riffly modular platform features.
 */
export interface ModuleDefinition<S extends ModuleSettingsSchema = ModuleSettingsSchema>
  extends ModuleLifecycleHooks<S> {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly version?: string | undefined;
  readonly alwaysOn?: boolean | undefined;
  readonly dependencies?: readonly string[] | undefined;
  readonly settings?: S | undefined;
  readonly commands?: readonly CommandDefinition[] | undefined;
  readonly events?: readonly EventListenerDefinition<unknown>[] | undefined;
  readonly tasks?: readonly ScheduledTaskDefinition[] | undefined;
}
