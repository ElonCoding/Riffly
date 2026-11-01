import { TaskRepository } from '../database/repositories/task-repository.js';
import type {
  CreateTaskInput,
  ITaskRepository,
  ScheduledTaskData,
} from '../database/types.js';
import type {
  SchedulerStatus,
  TaskHandler,
  TaskSchedulerOptions,
} from './types.js';

/**
 * Atomic persistent task scheduler for Riffly.
 * Periodically polls the database for due tasks and executes registered handlers.
 */
export class TaskScheduler {
  private readonly repository: ITaskRepository;
  private readonly pollIntervalMs: number;
  private readonly maxRetries: number;
  private readonly backoffBaseMs: number;
  private readonly batchSize: number;
  private readonly logger: TaskSchedulerOptions['logger'];

  private readonly handlers = new Map<string, TaskHandler>();
  private readonly processingTaskIds = new Set<string>();

  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private isPolling = false;

  constructor(options: TaskSchedulerOptions = {}) {
    this.repository = options.repository ?? new TaskRepository();
    this.pollIntervalMs = options.pollIntervalMs ?? 15_000;
    this.maxRetries = options.maxRetries ?? 5;
    this.backoffBaseMs = options.backoffBaseMs ?? 5_000;
    this.batchSize = options.batchSize ?? 25;
    this.logger = options.logger;
  }

  /**
   * Register a task execution handler for a specific task type.
   */
  public registerHandler<T = Record<string, unknown>>(
    taskType: string,
    handler: TaskHandler<T>,
  ): this {
    this.handlers.set(taskType, handler as TaskHandler);
    this.logInfo(`Registered handler for task type: "${taskType}"`);
    return this;
  }

  /**
   * Unregister an execution handler.
   */
  public unregisterHandler(taskType: string): boolean {
    const deleted = this.handlers.delete(taskType);
    if (deleted) {
      this.logInfo(`Unregistered handler for task type: "${taskType}"`);
    }
    return deleted;
  }

  /**
   * Check if a handler is registered for a given task type.
   */
  public hasHandler(taskType: string): boolean {
    return this.handlers.has(taskType);
  }

  /**
   * List all currently registered task types.
   */
  public getRegisteredTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Start the periodic background scheduler poll loop.
   */
  public start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.logInfo(
      `Task scheduler started (poll interval: ${this.pollIntervalMs}ms, batch size: ${this.batchSize})`,
    );

    this.timer = setInterval(() => {
      void this.poll();
    }, this.pollIntervalMs);

    // Ensure the interval timer doesn't hold the process open if not needed
    if (this.timer.unref) {
      this.timer.unref();
    }
  }

  /**
   * Stop the background scheduler poll loop and clean up timers.
   */
  public stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.logInfo('Task scheduler stopped');
  }

  /**
   * Execute a single poll cycle to process due tasks.
   * Safe against concurrent overlapping calls.
   *
   * @param force - If true, execute even if the scheduler loop is stopped (e.g. for manual triggers or tests).
   * @returns Total number of tasks successfully processed in this cycle.
   */
  public async poll(force = false): Promise<number> {
    if (!this.isRunning && !force) {
      return 0;
    }

    // Concurrency lock: prevent overlapping poll cycles
    if (this.isPolling) {
      this.logWarn('Previous poll cycle still in progress; skipping tick');
      return 0;
    }

    this.isPolling = true;
    let processedCount = 0;

    try {
      const now = new Date();
      const dueTasks = await this.repository.fetchDueTasks(now, this.batchSize);

      for (const task of dueTasks) {
        // Prevent concurrent processing of the same task in flight
        if (this.processingTaskIds.has(task.id)) {
          continue;
        }

        this.processingTaskIds.add(task.id);

        try {
          await this.executeTask(task);
          processedCount++;
        } finally {
          this.processingTaskIds.delete(task.id);
        }
      }
    } catch (err: unknown) {
      this.logError('Unexpected error during task scheduler poll cycle', err);
    } finally {
      this.isPolling = false;
    }

    return processedCount;
  }

  /**
   * Schedule a new persistent task in the database.
   */
  public async scheduleTask(input: CreateTaskInput): Promise<ScheduledTaskData> {
    return this.repository.createTask(input);
  }

  /**
   * Schedule a persistent task to run after a specified delay in milliseconds.
   */
  public async scheduleDelayed(
    guildId: string,
    taskType: string,
    payload: Record<string, unknown>,
    delayMs: number,
  ): Promise<ScheduledTaskData> {
    const executeAt = new Date(Date.now() + Math.max(0, delayMs));
    return this.scheduleTask({
      guildId,
      taskType,
      payload,
      executeAt,
    });
  }

  /**
   * Return current scheduler operational status.
   */
  public getStatus(): SchedulerStatus {
    return {
      isRunning: this.isRunning,
      isPolling: this.isPolling,
      registeredHandlers: this.getRegisteredTypes(),
      inFlightTasks: this.processingTaskIds.size,
      pollIntervalMs: this.pollIntervalMs,
    };
  }

  /**
   * Execute an individual task, handling handler dispatch and retry backoff.
   */
  private async executeTask(task: ScheduledTaskData): Promise<void> {
    const handler = this.handlers.get(task.taskType);

    if (!handler) {
      const errorMsg = `No handler registered for task type: "${task.taskType}"`;
      this.logWarn(`[Task:${task.id}] ${errorMsg}`);

      const nextRetries = task.retries + 1;
      if (nextRetries >= this.maxRetries) {
        await this.repository.incrementRetry(
          task.id,
          `Exceeded max retries (${this.maxRetries}): ${errorMsg}`,
        );
        await this.repository.markComplete(task.id);
      } else {
        const backoffMs = this.calculateBackoff(task.retries);
        const nextExecuteAt = new Date(Date.now() + backoffMs);
        await this.repository.incrementRetry(task.id, errorMsg, nextExecuteAt);
      }
      return;
    }

    try {
      await handler(task.payload, task);
      await this.repository.markComplete(task.id);
      this.logInfo(`[Task:${task.id}] Successfully completed task "${task.taskType}"`);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logError(`[Task:${task.id}] Failed executing "${task.taskType}": ${errorMsg}`, err);

      const nextRetries = task.retries + 1;
      if (nextRetries >= this.maxRetries) {
        await this.repository.incrementRetry(
          task.id,
          `Exceeded max retries (${this.maxRetries}): ${errorMsg}`,
        );
        // Mark as completed to prevent endless retries
        await this.repository.markComplete(task.id);
      } else {
        const backoffMs = this.calculateBackoff(task.retries);
        const nextExecuteAt = new Date(Date.now() + backoffMs);
        await this.repository.incrementRetry(task.id, errorMsg, nextExecuteAt);
      }
    }
  }

  /**
   * Calculate exponential backoff delay based on retry attempt.
   */
  private calculateBackoff(retries: number): number {
    return this.backoffBaseMs * Math.pow(2, retries);
  }

  private logInfo(message: string): void {
    if (this.logger?.info) {
      this.logger.info(`[TaskScheduler] ${message}`);
    }
  }

  private logWarn(message: string): void {
    if (this.logger?.warn) {
      this.logger.warn(`[TaskScheduler] ${message}`);
    } else {
      console.warn(`[TaskScheduler] ${message}`);
    }
  }

  private logError(message: string, error?: unknown): void {
    if (this.logger?.error) {
      this.logger.error(`[TaskScheduler] ${message}`, error);
    } else {
      console.error(`[TaskScheduler] ${message}`, error);
    }
  }
}
