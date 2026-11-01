export interface TicketCategory {
  readonly id: string;
  readonly name: string;
  readonly description?: string | undefined;
  readonly emoji?: string | undefined;
}

export interface TicketModuleSettings {
  readonly categoryId: string;
  readonly supportRoleId: string;
  readonly transcriptChannelId: string;
  readonly maxOpenTicketsPerUser: number;
}
