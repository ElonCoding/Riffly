import type { Prisma, PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../client.js';
import type {
  CreateTaskInput,
  ITaskRepository,
  ScheduledTaskData,
} from '../types.js';

/**
 * Repository for atomic persistent task operations.
 */
export class TaskRepository implements ITaskRepository {
  private readonly client: PrismaClient;

  constructor(client?: PrismaClient) {
    this.client = client ?? getPrismaClient();
  }

  /**
   * Persist a new scheduled task into the database.
   */
  public async createTask(data: CreateTaskInput): Promise<ScheduledTaskData> {
    // Ensure parent guild exists for relational integrity
    await this.ensureGuildExists(data.guildId);

    const record = await this.client.scheduledTask.create({
      data: {
        guildId: data.guildId,
        taskType: data.taskType,
        payload: data.payload as Prisma.InputJsonValue,
        executeAt: data.executeAt,
        executed: false,
        retries: 0,
      },
    });

    return {
      id: record.id,
      guildId: record.guildId,
      taskType: record.taskType,
      payload: (record.payload as Record<string, unknown>) ?? {},
      executeAt: record.executeAt,
      executed: record.executed,
      retries: record.retries,
      lastError: record.lastError,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  /**
   * Fetch unexecuted tasks that are due for execution at or before the given timestamp.
   */
  public async fetchDueTasks(
    now: Date = new Date(),
    limit = 50,
  ): Promise<ScheduledTaskData[]> {
    const records = await this.client.scheduledTask.findMany({
      where: {
        executed: false,
        executeAt: {
          lte: now,
        },
      },
      orderBy: {
        executeAt: 'asc',
      },
      take: limit,
    });

    return records.map((record) => ({
      id: record.id,
      guildId: record.guildId,
      taskType: record.taskType,
      payload: (record.payload as Record<string, unknown>) ?? {},
      executeAt: record.executeAt,
      executed: record.executed,
      retries: record.retries,
      lastError: record.lastError,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }));
  }

  /**
   * Mark a task as completed.
   */
  public async markComplete(taskId: string): Promise<ScheduledTaskData> {
    const record = await this.client.scheduledTask.update({
      where: { id: taskId },
      data: {
        executed: true,
        updatedAt: new Date(),
      },
    });

    return {
      id: record.id,
      guildId: record.guildId,
      taskType: record.taskType,
      payload: (record.payload as Record<string, unknown>) ?? {},
      executeAt: record.executeAt,
      executed: record.executed,
      retries: record.retries,
      lastError: record.lastError,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  /**
   * Increment retry count and update error message and next execution time.
   */
  public async incrementRetry(
    taskId: string,
    error: string,
    nextExecuteAt?: Date,
  ): Promise<ScheduledTaskData> {
    const record = await this.client.scheduledTask.update({
      where: { id: taskId },
      data: {
        retries: {
          increment: 1,
        },
        lastError: error,
        ...(nextExecuteAt ? { executeAt: nextExecuteAt } : {}),
        updatedAt: new Date(),
      },
    });

    return {
      id: record.id,
      guildId: record.guildId,
      taskType: record.taskType,
      payload: (record.payload as Record<string, unknown>) ?? {},
      executeAt: record.executeAt,
      executed: record.executed,
      retries: record.retries,
      lastError: record.lastError,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  /**
   * Retrieve a scheduled task by ID.
   */
  public async getTaskById(taskId: string): Promise<ScheduledTaskData | null> {
    const record = await this.client.scheduledTask.findUnique({
      where: { id: taskId },
    });

    if (!record) {
      return null;
    }

    return {
      id: record.id,
      guildId: record.guildId,
      taskType: record.taskType,
      payload: (record.payload as Record<string, unknown>) ?? {},
      executeAt: record.executeAt,
      executed: record.executed,
      retries: record.retries,
      lastError: record.lastError,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  /**
   * Delete a scheduled task by ID.
   */
  public async deleteTask(taskId: string): Promise<boolean> {
    try {
      await this.client.scheduledTask.delete({
        where: { id: taskId },
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Ensure that the parent GuildSettings record exists prior to foreign key creation.
   */
  private async ensureGuildExists(guildId: string): Promise<void> {
    await this.client.guildSettings.upsert({
      where: { guildId },
      update: {},
      create: {
        guildId,
        prefix: '!',
        locale: 'en',
      },
    });
  }
}
