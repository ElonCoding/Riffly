/**
 * Sanction action to take when an automod rule is triggered.
 */
export type AutoModAction = 'delete' | 'warn' | 'timeout';

/**
 * Filter rule identifier for AutoMod violations.
 */
export type AutoModRule =
  'anti-invite' | 'anti-link' | 'anti-caps' | 'mention-spam' | 'banned-words' | 'anti-spam';

/**
 * Configurable settings for the Riffly AutoMod module.
 */
export interface AutoModSettings {
  enabled?: boolean;
  antiInvite?: boolean;
  antiLink?: boolean;
  antiCaps?: boolean;
  capsPercentage?: number;
  antiMentionSpam?: boolean;
  maxMentions?: number;
  antiSpam?: boolean;
  spamMessageThreshold?: number;
  spamTimeWindowSeconds?: number;
  bannedWords?: string[];
  ignoredRoles?: string[];
  ignoredChannels?: string[];
  action?: AutoModAction;
  timeoutDurationSeconds?: number;
  logChannelId?: string;
}

/**
 * Result of evaluating a message against active automod rules.
 */
export interface AutoModCheckResult {
  triggered: boolean;
  rule?: AutoModRule;
  reason?: string;
  actionTaken?: AutoModAction;
}

/**
 * Context passed into AutoMod execution routines.
 */
export interface AutoModContext {
  getSettings?: (guildId: string, moduleId: string) => Promise<Record<string, unknown> | null>;
}
