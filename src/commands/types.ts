import type {
  ChatInputCommandInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';

export interface Command {
  readonly data: {
    readonly name: string;
    readonly toJSON: () => RESTPostAPIChatInputApplicationCommandsJSONBody;
  };
  readonly execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}
