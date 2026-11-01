export interface VoiceRoomSettings {
  readonly joinToCreateChannelId: string;
  readonly categoryId: string;
  readonly defaultUserLimit: number;
}

export interface ActiveVoiceRoom {
  readonly channelId: string;
  readonly guildId: string;
  ownerId: string;
  readonly createdAt: Date;
}

