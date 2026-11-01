import type {
  GuildSettings,
  GuildModule,
  ModerationCase,
  Ticket,
  ScheduledTask,
  UserLevel,
  Prisma,
} from '@prisma/client';

export type {
  GuildSettings,
  GuildModule,
  ModerationCase,
  Ticket,
  ScheduledTask,
  UserLevel,
};

/**
 * Domain representation of guild settings.
 */
export interface GuildSettingsData {
  guildId: string;
  prefix: string;
  locale: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Partial update payload for guild settings.
 */
export interface SaveGuildSettingsInput {
  prefix?: string;
  locale?: string;
}

/**
 * Domain representation of guild module configuration.
 */
export interface GuildModuleData {
  id: string;
  guildId: string;
  moduleId: string;
  enabled: boolean;
  settings: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Domain representation of a scheduled delayed task.
 */
export interface ScheduledTaskData {
  id: string;
  guildId: string;
  taskType: string;
  payload: Record<string, unknown>;
  executeAt: Date;
  executed: boolean;
  retries: number;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Payload to create a new scheduled task.
 */
export interface CreateTaskInput {
  guildId: string;
  taskType: string;
  payload: Record<string, unknown>;
  executeAt: Date;
}

/**
 * Payload to create a new moderation case.
 */
export interface CreateModerationCaseInput {
  guildId: string;
  targetId: string;
  moderatorId: string;
  action: string;
  reason?: string | null;
  durationMs?: bigint | null;
}

/**
 * Domain representation of a moderation case.
 */
export interface ModerationCaseData {
  id: string;
  caseNumber: number;
  guildId: string;
  targetId: string;
  moderatorId: string;
  action: string;
  reason: string | null;
  durationMs: bigint | null;
  active: boolean;
  createdAt: Date;
}

/**
 * Payload to create a new support ticket.
 */
export interface CreateTicketInput {
  guildId: string;
  channelId: string;
  creatorId: string;
  category?: string | null;
}

/**
 * Domain representation of a support ticket.
 */
export interface TicketData {
  id: string;
  guildId: string;
  channelId: string;
  creatorId: string;
  claimedBy: string | null;
  status: string;
  category: string | null;
  createdAt: Date;
  closedAt: Date | null;
}

/**
 * Domain representation of user experience and level.
 */
export interface UserLevelData {
  guildId: string;
  userId: string;
  xp: bigint;
  level: number;
  messagesCount: number;
  lastXpAt: Date | null;
}

/**
 * Contract for guild configuration repository operations.
 */
export interface IGuildRepository {
  getSettings(guildId: string): Promise<GuildSettingsData | null>;
  saveSettings(guildId: string, data: SaveGuildSettingsInput): Promise<GuildSettingsData>;
  getModuleConfig(guildId: string, moduleId: string): Promise<GuildModuleData | null>;
  setModuleEnabled(guildId: string, moduleId: string, enabled: boolean): Promise<GuildModuleData>;
  updateModuleSettings(
    guildId: string,
    moduleId: string,
    settings: Record<string, unknown>,
  ): Promise<GuildModuleData>;
}

/**
 * Contract for moderation case repository operations.
 */
export interface IModerationRepository {
  createCase(data: CreateModerationCaseInput): Promise<ModerationCaseData>;
  getCase(guildId: string, caseNumber: number): Promise<ModerationCaseData | null>;
  getCasesForTarget(guildId: string, targetId: string, limit?: number): Promise<ModerationCaseData[]>;
  getGuildCases(guildId: string, limit?: number, offset?: number): Promise<ModerationCaseData[]>;
  updateCase(
    guildId: string,
    caseNumber: number,
    data: { reason?: string | null; active?: boolean },
  ): Promise<ModerationCaseData | null>;
  countCases(guildId: string): Promise<number>;
}

/**
 * Contract for support ticket repository operations.
 */
export interface ITicketRepository {
  createTicket(data: CreateTicketInput): Promise<TicketData>;
  getTicketByChannel(guildId: string, channelId: string): Promise<TicketData | null>;
  getTicketById(ticketId: string): Promise<TicketData | null>;
  claimTicket(ticketId: string, moderatorId: string): Promise<TicketData | null>;
  unclaimTicket(ticketId: string): Promise<TicketData | null>;
  closeTicket(ticketId: string): Promise<TicketData | null>;
  reopenTicket(ticketId: string): Promise<TicketData | null>;
  listGuildTickets(
    guildId: string,
    status?: string,
    limit?: number,
    offset?: number,
  ): Promise<TicketData[]>;
}

/**
 * Contract for scheduled task repository operations.
 */
export interface ITaskRepository {
  createTask(data: CreateTaskInput): Promise<ScheduledTaskData>;
  fetchDueTasks(now?: Date, limit?: number): Promise<ScheduledTaskData[]>;
  markComplete(taskId: string): Promise<ScheduledTaskData>;
  incrementRetry(
    taskId: string,
    error: string,
    nextExecuteAt?: Date,
  ): Promise<ScheduledTaskData>;
  getTaskById(taskId: string): Promise<ScheduledTaskData | null>;
  deleteTask(taskId: string): Promise<boolean>;
}

/**
 * Prisma query types re-exported for convenience.
 */
export type JsonValue = Prisma.JsonValue;
