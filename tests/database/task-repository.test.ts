import { beforeEach, describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { TaskRepository } from '../../src/database/repositories/task-repository.js';
import type { GuildSettings, ScheduledTask } from '../../src/database/types.js';

/**
 * Stateful in-memory mock of PrismaClient for ScheduledTask and GuildSettings.
 */
function createMockPrismaClient(): PrismaClient {
  const taskStore = new Map<string, ScheduledTask>();
  const settingsStore = new Map<string, GuildSettings>();

  let idCounter = 1;

  return {
    guildSettings: {
      upsert: ({ where, create }: { where: { guildId: string }; create: GuildSettings }) => {
        const existing = settingsStore.get(where.guildId);
        if (existing) return Promise.resolve(existing);
        const created: GuildSettings = {
          guildId: create.guildId,
          prefix: create.prefix ?? '!',
          locale: create.locale ?? 'en',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        settingsStore.set(where.guildId, created);
        return Promise.resolve(created);
      },
    },
    scheduledTask: {
      create: ({
        data,
      }: {
        data: Omit<ScheduledTask, 'id' | 'createdAt' | 'updatedAt' | 'lastError'>;
      }) => {
        const id = `task_${idCounter++}`;
        const record: ScheduledTask = {
          id,
          guildId: data.guildId,
          taskType: data.taskType,
          payload: data.payload,
          executeAt: data.executeAt,
          executed: data.executed ?? false,
          retries: data.retries ?? 0,
          lastError: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        taskStore.set(id, record);
        return Promise.resolve(record);
      },
      findMany: ({
        where,
        orderBy,
        take,
      }: {
        where: { executed: boolean; executeAt: { lte: Date } };
        orderBy: { executeAt: 'asc' | 'desc' };
        take?: number;
      }) => {
        const tasks = Array.from(taskStore.values()).filter((t) => {
          if (t.executed !== where.executed) return false;
          if (t.executeAt.getTime() > where.executeAt.lte.getTime()) return false;
          return true;
        });

        tasks.sort((a, b) => {
          if (orderBy.executeAt === 'asc') {
            return a.executeAt.getTime() - b.executeAt.getTime();
          }
          return b.executeAt.getTime() - a.executeAt.getTime();
        });

        const result = typeof take === 'number' ? tasks.slice(0, take) : tasks;
        return Promise.resolve(result);
      },
      findUnique: ({ where }: { where: { id: string } }) => {
        return Promise.resolve(taskStore.get(where.id) ?? null);
      },
      update: ({
        where,
        data,
      }: {
        where: { id: string };
        data: {
          executed?: boolean;
          retries?: { increment: number };
          lastError?: string;
          executeAt?: Date;
          updatedAt?: Date;
        };
      }) => {
        const existing = taskStore.get(where.id);
        if (!existing) {
          return Promise.reject(new Error(`Record with id ${where.id} not found`));
        }

        let retries = existing.retries;
        if (data.retries?.increment) {
          retries += data.retries.increment;
        }

        const updated: ScheduledTask = {
          ...existing,
          executed: data.executed !== undefined ? data.executed : existing.executed,
          retries,
          lastError: data.lastError !== undefined ? data.lastError : existing.lastError,
          executeAt: data.executeAt ?? existing.executeAt,
          updatedAt: data.updatedAt ?? new Date(),
        };

        taskStore.set(where.id, updated);
        return Promise.resolve(updated);
      },
      delete: ({ where }: { where: { id: string } }) => {
        const existing = taskStore.get(where.id);
        if (!existing) {
          return Promise.reject(new Error(`Record with id ${where.id} not found`));
        }
        taskStore.delete(where.id);
        return Promise.resolve(existing);
      },
    },
  } as unknown as PrismaClient;
}

describe('TaskRepository', () => {
  let mockClient: PrismaClient;
  let repository: TaskRepository;

  beforeEach(() => {
    mockClient = createMockPrismaClient();
    repository = new TaskRepository(mockClient);
  });

  describe('createTask', () => {
    it('creates and returns a new scheduled task', async () => {
      const executeAt = new Date(Date.now() + 60_000);
      const payload = { userId: '123', reason: 'tempban' };

      const task = await repository.createTask({
        guildId: 'guild-1',
        taskType: 'moderation.unban',
        payload,
        executeAt,
      });

      expect(task.id).toBeDefined();
      expect(task.guildId).toBe('guild-1');
      expect(task.taskType).toBe('moderation.unban');
      expect(task.payload).toEqual(payload);
      expect(task.executeAt).toEqual(executeAt);
      expect(task.executed).toBe(false);
      expect(task.retries).toBe(0);
      expect(task.lastError).toBeNull();
    });
  });

  describe('fetchDueTasks', () => {
    it('fetches only unexecuted tasks that are due at or before now', async () => {
      const now = new Date(1_000_000);

      // Past/due task
      await repository.createTask({
        guildId: 'guild-1',
        taskType: 'task.due.1',
        payload: { id: 1 },
        executeAt: new Date(now.getTime() - 10_000),
      });

      // Exactly at now
      await repository.createTask({
        guildId: 'guild-1',
        taskType: 'task.due.2',
        payload: { id: 2 },
        executeAt: now,
      });

      // Future task
      await repository.createTask({
        guildId: 'guild-1',
        taskType: 'task.future',
        payload: { id: 3 },
        executeAt: new Date(now.getTime() + 10_000),
      });

      const due = await repository.fetchDueTasks(now);

      expect(due).toHaveLength(2);
      expect(due[0]?.taskType).toBe('task.due.1');
      expect(due[1]?.taskType).toBe('task.due.2');
    });

    it('does not return tasks that have already executed', async () => {
      const now = new Date(1_000_000);

      const task = await repository.createTask({
        guildId: 'guild-1',
        taskType: 'task.completed',
        payload: {},
        executeAt: new Date(now.getTime() - 5_000),
      });

      await repository.markComplete(task.id);

      const due = await repository.fetchDueTasks(now);
      expect(due).toHaveLength(0);
    });

    it('respects the batch limit argument', async () => {
      const now = new Date(1_000_000);

      for (let i = 0; i < 5; i++) {
        await repository.createTask({
          guildId: 'guild-1',
          taskType: `batch.task.${i}`,
          payload: { i },
          executeAt: new Date(now.getTime() - (5 - i) * 1000),
        });
      }

      const due = await repository.fetchDueTasks(now, 3);
      expect(due).toHaveLength(3);
      expect(due[0]?.taskType).toBe('batch.task.0');
      expect(due[1]?.taskType).toBe('batch.task.1');
      expect(due[2]?.taskType).toBe('batch.task.2');
    });
  });

  describe('markComplete', () => {
    it('sets executed to true and updates timestamp', async () => {
      const task = await repository.createTask({
        guildId: 'guild-1',
        taskType: 'sample',
        payload: {},
        executeAt: new Date(),
      });

      const completed = await repository.markComplete(task.id);
      expect(completed.executed).toBe(true);
      expect(completed.id).toBe(task.id);

      const fetched = await repository.getTaskById(task.id);
      expect(fetched?.executed).toBe(true);
    });
  });

  describe('incrementRetry', () => {
    it('increments retries and updates lastError and nextExecuteAt', async () => {
      const task = await repository.createTask({
        guildId: 'guild-1',
        taskType: 'sample',
        payload: {},
        executeAt: new Date(),
      });

      const nextAt = new Date(Date.now() + 15_000);
      const updated = await repository.incrementRetry(task.id, 'Connection timeout', nextAt);

      expect(updated.retries).toBe(1);
      expect(updated.lastError).toBe('Connection timeout');
      expect(updated.executeAt).toEqual(nextAt);

      const updated2 = await repository.incrementRetry(task.id, 'Rate limited');
      expect(updated2.retries).toBe(2);
      expect(updated2.lastError).toBe('Rate limited');
    });
  });

  describe('getTaskById and deleteTask', () => {
    it('returns null when task does not exist', async () => {
      const nonExistent = await repository.getTaskById('missing_id');
      expect(nonExistent).toBeNull();
    });

    it('successfully deletes an existing task', async () => {
      const task = await repository.createTask({
        guildId: 'guild-1',
        taskType: 'to.delete',
        payload: {},
        executeAt: new Date(),
      });

      const deleted = await repository.deleteTask(task.id);
      expect(deleted).toBe(true);

      const check = await repository.getTaskById(task.id);
      expect(check).toBeNull();
    });

    it('returns false when attempting to delete a non-existent task', async () => {
      const deleted = await repository.deleteTask('does_not_exist');
      expect(deleted).toBe(false);
    });
  });
});
