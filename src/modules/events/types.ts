import type { ModuleLogger } from '../core/types.js';
import type { ModuleRegistry } from '../core/registry.js';

/**
 * Event handler definition registered with EventDispatcher.
 */
export interface EventHandler<E = unknown> {
  readonly id: string;
  readonly moduleId?: string | undefined;
  readonly priority?: number | undefined;
  readonly once?: boolean | undefined;
  readonly filter?: ((args: E, guildId?: string) => boolean | Promise<boolean>) | undefined;
  readonly execute: (args: E, context?: unknown) => Promise<void> | void;
}

/**
 * Result details for an individual handler invocation.
 */
export interface HandlerExecutionResult {
  readonly handlerId: string;
  readonly moduleId?: string | undefined;
  readonly priority: number;
  readonly durationMs: number;
  readonly success: boolean;
  readonly error?: Error | undefined;
}

/**
 * Consolidated outcome returned when an event is dispatched.
 */
export interface DispatchResult {
  readonly event: string;
  readonly totalHandlers: number;
  readonly executedHandlers: number;
  readonly failures: readonly HandlerExecutionResult[];
}

/**
 * Error telemetry callback invoked when an isolated handler error occurs.
 */
export type DispatcherErrorHandler = (
  error: unknown,
  context: {
    readonly event: string;
    readonly moduleId?: string | undefined;
    readonly handlerId: string;
    readonly priority: number;
  },
) => void;

/**
 * Configuration options for the EventDispatcher.
 */
export interface EventDispatcherOptions {
  readonly registry?: ModuleRegistry | undefined;
  readonly onError?: DispatcherErrorHandler | undefined;
  readonly logger?: ModuleLogger | undefined;
}
