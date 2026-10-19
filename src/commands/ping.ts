import { SlashCommandBuilder } from 'discord.js';
import type { Command } from './types.js';

export const pingCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong and bot latency.'),
  async execute(interaction) {
    const wsPing = interaction.client.ws.ping;
    const wsPingText = wsPing >= 0 ? `${wsPing}ms` : 'measuring...';
    await interaction.reply({
      content: `Pong! Gateway ping: ${wsPingText}`,
    });
  },
};
