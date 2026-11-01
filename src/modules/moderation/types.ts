export type ModerationAction =
  | 'ban'
  | 'unban'
  | 'kick'
  | 'timeout'
  | 'warn'
  | 'softban'
  | 'purge'
  | 'lock'
  | 'unlock'
  | 'slowmode';

export interface ModerationSanctionInput {
  readonly guildId: string;
  readonly moderatorId: string;
  readonly targetId: string;
  readonly action: ModerationAction;
  readonly reason?: string | undefined;
  readonly durationMs?: number | bigint | undefined;
  readonly deleteMessageDays?: number | undefined;
}

export interface ModerationResult {
  readonly success: boolean;
  readonly action: ModerationAction;
  readonly caseNumber?: number | undefined;
  readonly message: string;
}

export interface ModerationModuleSettings {
  readonly logChannelId: string;
  readonly dmOnSanction: boolean;
  readonly defaultPurgeLimit: number;
}

