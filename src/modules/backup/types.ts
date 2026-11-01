/**
 * Backup module data structures.
 */

export interface RoleSnapshot {
  readonly id: string;
  readonly name: string;
  readonly color: number;
  readonly hoist: boolean;
  readonly position: number;
  readonly permissions: string;
}

export interface ChannelSnapshot {
  readonly id: string;
  readonly name: string;
  readonly type: number;
  readonly parentId?: string;
  readonly position: number;
  readonly topic?: string;
  readonly nsfw?: boolean;
  readonly bitrate?: number;
}

export interface GuildBackupSnapshot {
  readonly id: string;
  readonly guildId: string;
  readonly guildName: string;
  readonly createdAt: string;
  readonly roles: readonly RoleSnapshot[];
  readonly channels: readonly ChannelSnapshot[];
}

export interface IBackupService {
  createBackup(guild: unknown): Promise<GuildBackupSnapshot>;
  getBackups(guildId: string): Promise<readonly GuildBackupSnapshot[]>;
}

