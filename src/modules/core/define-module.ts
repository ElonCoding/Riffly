import type {
  CommandDefinition,
  EventListenerDefinition,
  ModuleDefinition,
  ModuleSettingsSchema,
  ScheduledTaskDefinition,
  SettingField,
  SettingType,
} from './types.js';

const VALID_SETTING_TYPES: ReadonlySet<SettingType> = new Set<SettingType>([
  'string',
  'number',
  'boolean',
  'string[]',
  'channel',
  'role',
  'json',
]);

const MODULE_ID_REGEX = /^[a-z0-9][a-z0-9-_]{0,63}$/;
const COMMAND_NAME_REGEX = /^[a-z0-9_-]{1,32}$/;

/**
 * Error thrown when a module definition violates contract requirements.
 */
export class ModuleValidationError extends Error {
  public readonly moduleId?: string | undefined;

  constructor(message: string, moduleId?: string) {
    super(moduleId ? `[Module:${moduleId}] ${message}` : message);
    this.name = 'ModuleValidationError';
    this.moduleId = moduleId;
    Object.setPrototypeOf(this, ModuleValidationError.prototype);
  }
}

/**
 * Validates settings schema definitions.
 */
function validateSettingsSchema(
  moduleId: string,
  schema: ModuleSettingsSchema,
): void {
  if (typeof schema !== 'object' || schema === null) {
    throw new ModuleValidationError('Settings schema must be a valid object.', moduleId);
  }

  for (const [key, field] of Object.entries(schema)) {
    if (!key || typeof key !== 'string') {
      throw new ModuleValidationError(`Invalid setting field key: "${String(key)}".`, moduleId);
    }

    if (typeof field !== 'object' || field === null) {
      throw new ModuleValidationError(
        `Setting field "${key}" must be an object definition.`,
        moduleId,
      );
    }

    const typedField: SettingField<unknown> = field;

    if (!VALID_SETTING_TYPES.has(typedField.type)) {
      throw new ModuleValidationError(
        `Setting field "${key}" has invalid type "${String(typedField.type)}". Supported types: ${Array.from(VALID_SETTING_TYPES).join(', ')}.`,
        moduleId,
      );
    }

    if (typedField.defaultValue === undefined) {
      throw new ModuleValidationError(
        `Setting field "${key}" must define a defaultValue.`,
        moduleId,
      );
    }

    if (typeof typedField.validate === 'function') {
      const validationResult = typedField.validate(typedField.defaultValue);
      if (validationResult === false || typeof validationResult === 'string') {
        const errorDetail =
          typeof validationResult === 'string'
            ? validationResult
            : 'Default value does not satisfy validator.';
        throw new ModuleValidationError(
          `Setting field "${key}" defaultValue failed validation: ${errorDetail}`,
          moduleId,
        );
      }
    }
  }
}

/**
 * Validates module slash command definitions.
 */
function validateCommands(moduleId: string, commands: readonly CommandDefinition[]): void {
  const seenNames = new Set<string>();

  for (const cmd of commands) {
    if (!cmd || typeof cmd !== 'object') {
      throw new ModuleValidationError('Command definition must be a valid object.', moduleId);
    }

    if (!cmd.name || typeof cmd.name !== 'string' || !COMMAND_NAME_REGEX.test(cmd.name)) {
      throw new ModuleValidationError(
        `Command name "${String(cmd.name)}" is invalid. Must be 1-32 lowercase characters, numbers, underscores, or hyphens.`,
        moduleId,
      );
    }

    if (seenNames.has(cmd.name)) {
      throw new ModuleValidationError(
        `Duplicate command name "${cmd.name}" detected in module.`,
        moduleId,
      );
    }
    seenNames.add(cmd.name);

    if (
      !cmd.description ||
      typeof cmd.description !== 'string' ||
      cmd.description.trim().length === 0 ||
      cmd.description.length > 100
    ) {
      throw new ModuleValidationError(
        `Command "${cmd.name}" description must be between 1 and 100 characters.`,
        moduleId,
      );
    }

    if (typeof cmd.execute !== 'function') {
      throw new ModuleValidationError(
        `Command "${cmd.name}" execute handler must be a function.`,
        moduleId,
      );
    }
  }
}

/**
 * Validates module event listener registrations.
 */
function validateEvents(
  moduleId: string,
  events: readonly EventListenerDefinition<unknown>[],
): void {
  for (const evt of events) {
    if (!evt || typeof evt !== 'object') {
      throw new ModuleValidationError('Event definition must be a valid object.', moduleId);
    }

    if (!evt.event || typeof evt.event !== 'string' || evt.event.trim().length === 0) {
      throw new ModuleValidationError('Event listener must specify a non-empty event name.', moduleId);
    }

    if (typeof evt.execute !== 'function') {
      throw new ModuleValidationError(
        `Event listener for "${evt.event}" execute handler must be a function.`,
        moduleId,
      );
    }

    if (evt.priority !== undefined && (typeof evt.priority !== 'number' || !Number.isFinite(evt.priority))) {
      throw new ModuleValidationError(
        `Event listener for "${evt.event}" priority must be a finite number.`,
        moduleId,
      );
    }

    if (evt.filter !== undefined && typeof evt.filter !== 'function') {
      throw new ModuleValidationError(
        `Event listener for "${evt.event}" filter must be a function.`,
        moduleId,
      );
    }
  }
}

/**
 * Validates scheduled background task registrations.
 */
function validateTasks(moduleId: string, tasks: readonly ScheduledTaskDefinition[]): void {
  const seenTaskNames = new Set<string>();

  for (const task of tasks) {
    if (!task || typeof task !== 'object') {
      throw new ModuleValidationError('Task definition must be a valid object.', moduleId);
    }

    if (!task.name || typeof task.name !== 'string' || task.name.trim().length === 0) {
      throw new ModuleValidationError('Task must define a non-empty name.', moduleId);
    }

    if (seenTaskNames.has(task.name)) {
      throw new ModuleValidationError(`Duplicate task name "${task.name}" in module.`, moduleId);
    }
    seenTaskNames.add(task.name);

    if (typeof task.execute !== 'function') {
      throw new ModuleValidationError(`Task "${task.name}" execute handler must be a function.`, moduleId);
    }

    if (
      task.intervalMs !== undefined &&
      (typeof task.intervalMs !== 'number' || !Number.isInteger(task.intervalMs) || task.intervalMs <= 0)
    ) {
      throw new ModuleValidationError(
        `Task "${task.name}" intervalMs must be a positive integer.`,
        moduleId,
      );
    }

    if (task.cron !== undefined && (typeof task.cron !== 'string' || task.cron.trim().length === 0)) {
      throw new ModuleValidationError(
        `Task "${task.name}" cron expression must be a non-empty string.`,
        moduleId,
      );
    }
  }
}

/**
 * Declarative module factory validating and freezing module definitions.
 *
 * @param definition Raw module definition conforming to ModuleDefinition<S>
 * @returns Fully validated and immutable ModuleDefinition<S>
 * @throws ModuleValidationError if any constraint or contract requirement is violated
 */
export function defineModule<S extends ModuleSettingsSchema = ModuleSettingsSchema>(
  definition: ModuleDefinition<S>,
): ModuleDefinition<S> {
  if (!definition || typeof definition !== 'object') {
    throw new ModuleValidationError('Module definition must be a non-null object.');
  }

  const { id, name, description } = definition;

  if (!id || typeof id !== 'string' || !MODULE_ID_REGEX.test(id)) {
    throw new ModuleValidationError(
      `Module ID "${String(id)}" is invalid. Must be 1-64 lowercase alphanumeric characters, hyphens, or underscores.`,
      id,
    );
  }

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new ModuleValidationError('Module name must be a non-empty string.', id);
  }

  if (!description || typeof description !== 'string' || description.trim().length === 0) {
    throw new ModuleValidationError('Module description must be a non-empty string.', id);
  }

  if (definition.dependencies !== undefined) {
    const isDepsArray: boolean = Array.isArray(definition.dependencies);
    if (!isDepsArray) {
      throw new ModuleValidationError('Module dependencies must be an array of module IDs.', id);
    }
    const depSet = new Set<string>();
    for (const dep of definition.dependencies) {
      if (!dep || typeof dep !== 'string' || !MODULE_ID_REGEX.test(dep)) {
        throw new ModuleValidationError(`Invalid dependency module ID: "${String(dep)}".`, id);
      }
      if (dep === id) {
        throw new ModuleValidationError(`Module "${id}" cannot depend on itself.`, id);
      }
      if (depSet.has(dep)) {
        throw new ModuleValidationError(`Duplicate dependency ID "${dep}" declared.`, id);
      }
      depSet.add(dep);
    }
  }

  if (definition.settings !== undefined) {
    validateSettingsSchema(id, definition.settings);
  }

  if (definition.commands !== undefined) {
    const isCmdsArray: boolean = Array.isArray(definition.commands);
    if (!isCmdsArray) {
      throw new ModuleValidationError('Module commands must be an array.', id);
    }
    validateCommands(id, definition.commands);
  }

  if (definition.events !== undefined) {
    const isEventsArray: boolean = Array.isArray(definition.events);
    if (!isEventsArray) {
      throw new ModuleValidationError('Module events must be an array.', id);
    }
    validateEvents(id, definition.events);
  }

  if (definition.tasks !== undefined) {
    const isTasksArray: boolean = Array.isArray(definition.tasks);
    if (!isTasksArray) {
      throw new ModuleValidationError('Module tasks must be an array.', id);
    }
    validateTasks(id, definition.tasks);
  }

  const hooks = [
    'onLoad',
    'onUnload',
    'onGuildEnable',
    'onGuildDisable',
    'onEnable',
    'onDisable',
  ] as const;

  for (const hook of hooks) {
    const fn = definition[hook];
    if (fn !== undefined && typeof fn !== 'function') {
      throw new ModuleValidationError(`Lifecycle hook "${hook}" must be a function.`, id);
    }
  }

  return Object.freeze({ ...definition });
}
