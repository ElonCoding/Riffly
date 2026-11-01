import type { ITaskRepository, ScheduledTaskData } from '../database/types.js';

/**
 * Handler function signature for scheduled task execution.
 */
export type TaskHandler<T = Record<string, unknown>> = (
  payload: T,
  task: ScheduledTaskData,
) => Promise<void>;

/**
 * Configuration options for the atomic task scheduler.
 */
export interface TaskSchedulerOptions {
  /**
   * Interval in milliseconds between scheduler poll iterations.
   * Default: 15,000ms.
   */
  pollIntervalMs?: number;

  /**
   * Maximum retry attempts before marking a task permanently failed.
   * Default: 5.
   */
  maxRetries?: number;

  /**
   * Base delay in milliseconds for exponential retry backoff.
   * Next execute delay = backoffBaseMs * 2^(retryCount).
   * Default: 5,000ms.
   */
  backoffBaseMs?: number;

  /**
   * Maximum number of due tasks to claim in a single poll execution.
   * Default: 25.
   */
  batchSize?: number;

  /**
   * Repository used for database task queries and updates.
   * Defaults to a new TaskRepository instance.
   */
  repository?: ITaskRepository;

  /**
   * Optional custom logger.
   */
  logger?: {
    info?: (message: string) => void;
    warn?: (message: string) => void;
    error?: (message: string, error?: unknown) => void;
  };
}

/**
 * Operational runtime status of the scheduler.
 */
export interface SchedulerStatus {
  isRunning: boolean;
  isPolling: boolean;
  registeredHandlers: string[];
  inFlightTasks: number;
  pollIntervalMs: number;
}
