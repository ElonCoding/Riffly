import type { Client } from 'discord.js';
import type { ModuleDefinition, ModuleLogger } from '../core/types.js';
import type { ModuleRegistry } from '../core/registry.js';
import type {
  DispatcherErrorHandler,
  DispatchResult,
  EventHandler,
  EventDispatcherOptions,
  HandlerExecutionResult,
} from './types.js';

let handlerIdCounter = 0;
function generateHandlerId(prefix = 'handler'): string {
  handlerIdCounter += 1;
  return `${prefix}_${handlerIdCounter}_${Date.now()}`;
}

/**
 * Extracts a Discord guild ID from common event payloads.
 */
function extractGuildId(arg: unknown): string | undefined {
  if (!arg || typeof arg !== 'object') {
    return undefined;
  }

  const obj = arg as Record<string, unknown>;

  if (typeof obj['guildId'] === 'string') {
    return obj['guildId'];
  }

  if (obj['guild'] && typeof obj['guild'] === 'object') {
    const guildObj = obj['guild'] as Record<string, unknown>;
    if (typeof guildObj['id'] === 'string') {
      return guildObj['id'];
    }
  }

  // Guild object itself
  if (typeof obj['id'] === 'string' && 'roles' in obj && 'channels' in obj) {
    return obj['id'];
  }

  return undefined;
}

/**
 * Central event bus coordinating priority-ordered event execution
 * with isolated try/catch boundaries across modular bot features.
 */
export class EventDispatcher {
  private readonly handlers = new Map<string, EventHandler<unknown>[]>();
  private readonly clientListeners = new Map<string, (...args: unknown[]) => void>();
  private client: Client | undefined;
  private registry: ModuleRegistry | undefined;
  private readonly onError: DispatcherErrorHandler | undefined;
  private readonly logger: ModuleLogger | undefined;

  constructor(options: EventDispatcherOptions = {}) {
    this.registry = options.registry;
    this.onError = options.onError;
    this.logger = options.logger;
  }

  /**
   * Links or updates the ModuleRegistry used for guild-level module activation filtering.
   */
  public setRegistry(registry: ModuleRegistry): this {
    this.registry = registry;
    return this;
  }

  /**
   * Registers a standalone event handler.
   *
   * @param event The event identifier (e.g. 'messageCreate', 'guildMemberAdd')
   * @param handler Handler configuration with priority and execution callback
   * @returns Unsubscribe function to remove this handler
   */
  public registerHandler<E = unknown>(
    event: string,
    handler: Omit<EventHandler<E>, 'id' | 'priority'> & {
      readonly id?: string | undefined;
      readonly priority?: number | undefined;
    },
  ): () => void {
    const id = handler.id ?? generateHandlerId(handler.moduleId ?? 'handler');
    const fullHandler: EventHandler<E> = {
      id,
      moduleId: handler.moduleId,
      priority: handler.priority ?? 0,
      once: handler.once,
      filter: handler.filter,
      execute: handler.execute,
    };

    let list = this.handlers.get(event);
    if (!list) {
      list = [];
      this.handlers.set(event, list);
    }
    list.push(fullHandler as unknown as EventHandler<unknown>);

    // If client is already attached, bind client listener for this event if not present
    if (this.client && !this.clientListeners.has(event)) {
      this.bindClientEvent(event);
    }

    return () => {
      this.unregisterHandler(event, id);
    };
  }

  /**
   * Unregisters an event handler by event name and handler ID.
   */
  public unregisterHandler(event: string, handlerId: string): boolean {
    const list = this.handlers.get(event);
    if (!list) {
      return false;
    }

    const initialLength = list.length;
    const filtered = list.filter((h) => h.id !== handlerId);
    if (filtered.length === 0) {
      this.handlers.delete(event);
    } else {
      this.handlers.set(event, filtered);
    }

    return filtered.length < initialLength;
  }

  /**
   * Registers all event listeners defined by a module.
   */
  public registerModule(module: ModuleDefinition): this {
    if (!module.events || module.events.length === 0) {
      return this;
    }

    module.events.forEach((evt, idx) => {
      this.registerHandler(evt.event, {
        id: `${module.id}:${evt.event}:${idx}`,
        moduleId: module.id,
        priority: evt.priority ?? 0,
        once: evt.once,
        filter: evt.filter,
        execute: evt.execute,
      });
    });

    return this;
  }

  /**
   * Registers all events from all modules currently present in the registry.
   */
  public registerRegistry(registry: ModuleRegistry): this {
    this.registry = registry;
    for (const mod of registry.getAll()) {
      this.registerModule(mod);
    }
    return this;
  }

  /**
   * Attaches the dispatcher to a Discord.js Client, forwarding gateway events.
   */
  public attach(client: Client): this {
    if (this.client === client) {
      return this;
    }

    this.detach();
    this.client = client;

    // Bind listeners for all currently registered events
    for (const event of this.handlers.keys()) {
      this.bindClientEvent(event);
    }

    return this;
  }

  /**
   * Detaches from the current Discord.js Client.
   */
  public detach(): this {
    if (!this.client) {
      return this;
    }

    for (const [event, listener] of this.clientListeners.entries()) {
      this.client.off(event, listener);
    }

    this.clientListeners.clear();
    this.client = undefined;
    return this;
  }

  /**
   * Binds an event listener to the active Discord.js Client.
   */
  private bindClientEvent(event: string): void {
    if (!this.client || this.clientListeners.has(event)) {
      return;
    }

    const listener = (...args: unknown[]) => {
      void this.dispatch(event, ...args);
    };

    this.client.on(event, listener);
    this.clientListeners.set(event, listener);
  }

  /**
   * Dispatches an event through registered handlers with strict priority ordering
   * and isolated error handling.
   *
   * @param event The event name
   * @param args Payload arguments forwarded from the event
   * @returns Detailed DispatchResult including execution counts and isolated failures
   */
  public async dispatch(event: string, ...args: unknown[]): Promise<DispatchResult> {
    const registered = this.handlers.get(event);
    if (!registered || registered.length === 0) {
      return {
        event,
        totalHandlers: 0,
        executedHandlers: 0,
        failures: [],
      };
    }

    // Sort by priority descending (higher number runs first)
    const sorted = [...registered].sort((a, b) => b.priority - a.priority);

    const payload = args.length === 1 ? args[0] : args;
    const guildId = extractGuildId(payload);

    let executedHandlers = 0;
    const failures: HandlerExecutionResult[] = [];
    const onceHandlerIdsToRemove = new Set<string>();

    for (const handler of sorted) {
      // Guild activation check: if module is associated, verify module is enabled in this guild
      if (handler.moduleId && this.registry && guildId) {
        if (!this.registry.isModuleEnabled(guildId, handler.moduleId)) {
          continue;
        }
      }

      // Filter check
      if (handler.filter) {
        try {
          const passes = await handler.filter(payload, guildId);
          if (!passes) {
            continue;
          }
        } catch (filterErr: unknown) {
          const err = filterErr instanceof Error ? filterErr : new Error(String(filterErr));
          this.logError(
            `Filter error for handler "${handler.id}" on event "${event}": ${err.message}`,
          );
          continue;
        }
      }

      if (handler.once) {
        onceHandlerIdsToRemove.add(handler.id);
      }

      executedHandlers += 1;
      const startTime = Date.now();

      // Isolated execution boundary: crashes NEVER escape to caller or sibling handlers
      try {
        await handler.execute(payload, { guildId, event, dispatcher: this });
      } catch (handlerErr: unknown) {
        const error = handlerErr instanceof Error ? handlerErr : new Error(String(handlerErr));
        const durationMs = Date.now() - startTime;

        const failureDetail: HandlerExecutionResult = {
          handlerId: handler.id,
          moduleId: handler.moduleId,
          priority: handler.priority,
          durationMs,
          success: false,
          error,
        };

        failures.push(failureDetail);

        this.logError(
          `Isolated error in handler "${handler.id}" (module: "${handler.moduleId ?? 'core'}", priority: ${handler.priority}) on event "${event}": ${error.message}`,
        );

        if (this.onError) {
          try {
            this.onError(error, {
              event,
              moduleId: handler.moduleId,
              handlerId: handler.id,
              priority: handler.priority,
            });
          } catch (telemetryErr: unknown) {
            this.logError(
              `Dispatcher onError hook threw: ${telemetryErr instanceof Error ? telemetryErr.message : String(telemetryErr)}`,
            );
          }
        }
      }
    }

    // Clean up one-time handlers
    if (onceHandlerIdsToRemove.size > 0) {
      const remaining = registered.filter((h) => !onceHandlerIdsToRemove.has(h.id));
      if (remaining.length === 0) {
        this.handlers.delete(event);
      } else {
        this.handlers.set(event, remaining);
      }
    }

    return {
      event,
      totalHandlers: registered.length,
      executedHandlers,
      failures,
    };
  }

  /**
   * Internal error logging helper.
   */
  private logError(message: string): void {
    if (this.logger) {
      this.logger.error(message);
    } else {
      console.error(`[EventDispatcher] ${message}`);
    }
  }

  /**
   * Returns count of registered handlers for an event, or all events if omitted.
   */
  public getHandlerCount(event?: string): number {
    if (event) {
      return this.handlers.get(event)?.length ?? 0;
    }

    let total = 0;
    for (const list of this.handlers.values()) {
      total += list.length;
    }
    return total;
  }

  /**
   * Clears handlers for an event, or all handlers if omitted.
   */
  public clearHandlers(event?: string): void {
    if (event) {
      this.handlers.delete(event);
      const listener = this.clientListeners.get(event);
      if (listener && this.client) {
        this.client.off(event, listener);
        this.clientListeners.delete(event);
      }
    } else {
      if (this.client) {
        for (const [evt, listener] of this.clientListeners.entries()) {
          this.client.off(evt, listener);
        }
      }
      this.clientListeners.clear();
      this.handlers.clear();
    }
  }
}
