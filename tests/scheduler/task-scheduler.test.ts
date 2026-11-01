import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ITaskRepository, ScheduledTaskData } from '../../src/database/types.js';
import { TaskScheduler } from '../../src/scheduler/task-scheduler.js';

/**
 * In-memory stateful test repository implementing ITaskRepository.
 */
class InMemoryTaskRepository implements ITaskRepository {
  private tasks = new Map<string, ScheduledTaskData>();
  private idCounter = 1;

  public createTask(data: {
    guildId: string;
    taskType: string;
    payload: Record<string, unknown>;
    executeAt: Date;
  }): Promise<ScheduledTaskData> {
    const id = `task_${this.idCounter++}`;
    const task: ScheduledTaskData = {
      id,
      guildId: data.guildId,
      taskType: data.taskType,
      payload: data.payload,
      executeAt: data.executeAt,
      executed: false,
      retries: 0,
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.tasks.set(id, task);
    return Promise.resolve(task);
  }

  public fetchDueTasks(
    now: Date = new Date(),
    limit = 50,
  ): Promise<ScheduledTaskData[]> {
    const due = Array.from(this.tasks.values())
      .filter((t) => !t.executed && t.executeAt.getTime() <= now.getTime())
      .sort((a, b) => a.executeAt.getTime() - b.executeAt.getTime())
      .slice(0, limit);
    return Promise.resolve(due);
  }

  public markComplete(taskId: string): Promise<ScheduledTaskData> {
    const task = this.tasks.get(taskId);
    if (!task) return Promise.reject(new Error(`Task ${taskId} not found`));
    task.executed = true;
    task.updatedAt = new Date();
    return Promise.resolve({ ...task });
  }

  public incrementRetry(
    taskId: string,
    error: string,
    nextExecuteAt?: Date,
  ): Promise<ScheduledTaskData> {
    const task = this.tasks.get(taskId);
    if (!task) return Promise.reject(new Error(`Task ${taskId} not found`));
    task.retries += 1;
    task.lastError = error;
    if (nextExecuteAt) {
      task.executeAt = nextExecuteAt;
    }
    task.updatedAt = new Date();
    return Promise.resolve({ ...task });
  }

  public getTaskById(taskId: string): Promise<ScheduledTaskData | null> {
    return Promise.resolve(this.tasks.get(taskId) ?? null);
  }

  public deleteTask(taskId: string): Promise<boolean> {
    return Promise.resolve(this.tasks.delete(taskId));
  }
}

describe('TaskScheduler', () => {
  let repository: InMemoryTaskRepository;
  let scheduler: TaskScheduler;

  beforeEach(() => {
    repository = new InMemoryTaskRepository();
    scheduler = new TaskScheduler({
      repository,
      pollIntervalMs: 15_000,
      maxRetries: 3,
      backoffBaseMs: 1_000,
      batchSize: 10,
    });
  });

  describe('Lifecycle Management', () => {
    it('initializes with inactive status', () => {
      const status = scheduler.getStatus();
      expect(status.isRunning).toBe(false);
      expect(status.isPolling).toBe(false);
      expect(status.registeredHandlers).toHaveLength(0);
      expect(status.inFlightTasks).toBe(0);
      expect(status.pollIntervalMs).toBe(15_000);
    });

    it('starts and stops gracefully', () => {
      scheduler.start();
      expect(scheduler.getStatus().isRunning).toBe(true);

      // Idempotent start
      scheduler.start();
      expect(scheduler.getStatus().isRunning).toBe(true);

      scheduler.stop();
      expect(scheduler.getStatus().isRunning).toBe(false);

      // Idempotent stop
      scheduler.stop();
      expect(scheduler.getStatus().isRunning).toBe(false);
    });
  });

  describe('Handler Registration', () => {
    it('registers and unregisters task handlers', () => {
      const handler = vi.fn().mockResolvedValue(undefined);

      scheduler.registerHandler('moderation.unban', handler);
      expect(scheduler.hasHandler('moderation.unban')).toBe(true);
      expect(scheduler.getRegisteredTypes()).toEqual(['moderation.unban']);

      const removed = scheduler.unregisterHandler('moderation.unban');
      expect(removed).toBe(true);
      expect(scheduler.hasHandler('moderation.unban')).toBe(false);
    });

    it('returns false when unregistering unknown handler', () => {
      expect(scheduler.unregisterHandler('unknown.task')).toBe(false);
    });
  });

  describe('Task Execution & Polling', () => {
    it('does not poll if scheduler is not running and force=false', async () => {
      await repository.createTask({
        guildId: 'guild-1',
        taskType: 'test.task',
        payload: { value: 42 },
        executeAt: new Date(Date.now() - 5000),
      });

      const processed = await scheduler.poll(false);
      expect(processed).toBe(0);
    });

    it('processes due tasks and invokes registered handler', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      scheduler.registerHandler('reminder.send', handler);

      const task = await repository.createTask({
        guildId: 'guild-1',
        taskType: 'reminder.send',
        payload: { channelId: 'c1', message: 'Time to drink water' },
        executeAt: new Date(Date.now() - 1000),
      });

      const processed = await scheduler.poll(true);

      expect(processed).toBe(1);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(
        { channelId: 'c1', message: 'Time to drink water' },
        expect.objectContaining({ id: task.id }),
      );

      const completedTask = await repository.getTaskById(task.id);
      expect(completedTask?.executed).toBe(true);
    });

    it('ignores tasks scheduled for the future', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      scheduler.registerHandler('delayed.action', handler);

      await repository.createTask({
        guildId: 'guild-1',
        taskType: 'delayed.action',
        payload: {},
        executeAt: new Date(Date.now() + 60_000),
      });

      const processed = await scheduler.poll(true);
      expect(processed).toBe(0);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling and Exponential Backoff', () => {
    it('applies exponential backoff on handler error', async () => {
      const failingHandler = vi.fn().mockRejectedValue(new Error('Gateway down'));
      scheduler.registerHandler('flaky.task', failingHandler);

      const task = await repository.createTask({
        guildId: 'guild-1',
        taskType: 'flaky.task',
        payload: {},
        executeAt: new Date(Date.now() - 1000),
      });

      const beforePoll = Date.now();
      await scheduler.poll(true);

      const updated = await repository.getTaskById(task.id);
      expect(updated?.retries).toBe(1);
      expect(updated?.lastError).toBe('Gateway down');
      expect(updated?.executed).toBe(false);

      // Expected backoff = 1000ms * 2^0 = 1000ms
      expect(updated?.executeAt.getTime()).toBeGreaterThanOrEqual(beforePoll + 900);
    });

    it('marks task completed when retries reach maxRetries', async () => {
      const failingHandler = vi.fn().mockRejectedValue(new Error('Persistent error'));
      scheduler.registerHandler('doomed.task', failingHandler);

      const task = await repository.createTask({
        guildId: 'guild-1',
        taskType: 'doomed.task',
        payload: {},
        executeAt: new Date(Date.now() - 1000),
      });

      // Attempt 1 (retries 0 -> 1)
      await scheduler.poll(true);
      let t = await repository.getTaskById(task.id);
      expect(t?.retries).toBe(1);
      expect(t?.executed).toBe(false);

      // Force executeAt back to now for attempt 2
      t!.executeAt = new Date(Date.now() - 1000);
      await scheduler.poll(true);
      t = await repository.getTaskById(task.id);
      expect(t?.retries).toBe(2);
      expect(t?.executed).toBe(false);

      // Force executeAt back to now for attempt 3 (reaches maxRetries = 3)
      t!.executeAt = new Date(Date.now() - 1000);
      await scheduler.poll(true);
      t = await repository.getTaskById(task.id);
      expect(t?.retries).toBe(3);
      expect(t?.executed).toBe(true); // Terminated to prevent endless polling
      expect(t?.lastError).toContain('Exceeded max retries (3)');
    });

    it('handles tasks with no registered handler by applying backoff', async () => {
      const task = await repository.createTask({
        guildId: 'guild-1',
        taskType: 'unhandled.type',
        payload: {},
        executeAt: new Date(Date.now() - 1000),
      });

      await scheduler.poll(true);

      const updated = await repository.getTaskById(task.id);
      expect(updated?.retries).toBe(1);
      expect(updated?.lastError).toContain('No handler registered for task type: "unhandled.type"');
    });
  });

  describe('Safe Concurrency & Overlapping Prevention', () => {
    it('prevents overlapping poll cycles', async () => {
      let resolveSlowHandler!: () => void;
      const slowHandlerPromise = new Promise<void>((resolve) => {
        resolveSlowHandler = resolve;
      });

      scheduler.registerHandler('slow.task', async () => {
        await slowHandlerPromise;
      });

      await repository.createTask({
        guildId: 'guild-1',
        taskType: 'slow.task',
        payload: {},
        executeAt: new Date(Date.now() - 1000),
      });

      // Start first poll (hangs in slowHandler)
      const poll1Promise = scheduler.poll(true);

      // Verify scheduler status reports isPolling
      expect(scheduler.getStatus().isPolling).toBe(true);

      // Trigger second poll concurrently
      const poll2Result = await scheduler.poll(true);
      expect(poll2Result).toBe(0); // Safely skipped!

      // Finish first handler
      resolveSlowHandler();
      const poll1Result = await poll1Promise;
      expect(poll1Result).toBe(1);
      expect(scheduler.getStatus().isPolling).toBe(false);
    });
  });

  describe('Scheduling Helpers', () => {
    it('schedules a task via scheduleTask', async () => {
      const executeAt = new Date(Date.now() + 10_000);
      const scheduled = await scheduler.scheduleTask({
        guildId: 'guild-2',
        taskType: 'custom.event',
        payload: { tag: 'abc' },
        executeAt,
      });

      expect(scheduled.id).toBeDefined();
      expect(scheduled.taskType).toBe('custom.event');
      expect(scheduled.executeAt).toEqual(executeAt);
    });

    it('schedules a delayed task via scheduleDelayed', async () => {
      const before = Date.now();
      const scheduled = await scheduler.scheduleDelayed(
        'guild-2',
        'delayed.ping',
        { msg: 'hello' },
        5_000,
      );

      expect(scheduled.taskType).toBe('delayed.ping');
      expect(scheduled.executeAt.getTime()).toBeGreaterThanOrEqual(before + 4_900);
    });
  });

  describe('Custom Logger Integration', () => {
    it('invokes custom logger methods if provided', () => {
      const logger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };

      const customScheduler = new TaskScheduler({
        repository,
        logger,
      });

      customScheduler.registerHandler('logged.task', async () => {});
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Registered handler for task type: "logged.task"'),
      );

      customScheduler.start();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Task scheduler started'),
      );

      customScheduler.stop();
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Task scheduler stopped'),
      );
    });
  });
});
