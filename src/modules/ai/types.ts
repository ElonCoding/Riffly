export interface AiSettings {
  enabled?: boolean;
  cooldownSeconds?: number;
  systemPrompt?: string;
}

export interface IAiProvider {
  generateResponse(prompt: string, systemPrompt?: string): Promise<string>;
}

