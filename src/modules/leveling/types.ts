export interface LevelingSettings {
  readonly enabled: boolean;
  readonly minXpPerMessage: number;
  readonly maxXpPerMessage: number;
  readonly cooldownSeconds: number;
  readonly levelUpChannelId: string;
}

export interface XpAwardResult {
  readonly awarded: boolean;
  readonly xpGained: number;
  readonly leveledUp: boolean;
  readonly oldLevel: number;
  readonly newLevel: number;
  readonly totalXp: bigint;
}

