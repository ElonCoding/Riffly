import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { CommandDefinition } from '../core/types.js';
import type { AiService } from './service.js';

export function createAiCommands(service: AiService): CommandDefinition[] {
  const askCmd: CommandDefinition = {
    name: 'ask',
    description: 'Ask the Riffly AI Assistant a question about the server or bot features.',
    data: new SlashCommandBuilder()
      .setName('ask')
      .setDescription('Ask the Riffly AI Assistant a question about the server or bot features.')
      .addStringOption((opt) =>
        opt.setName('question').setDescription('Your question for the assistant').setRequired(true),
      ),
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: false });

      const question = interaction.options.getString('question', true);
      const result = await service.ask(interaction.user.id, question);

      if (result.onCooldown) {
        await interaction.editReply({
          content: `⏳ Please wait ${result.remainingSeconds ?? 1}s before asking another question.`,
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('🤖 Riffly AI Assistant')
        .setColor(0x8b5cf6)
        .addFields(
          { name: 'Question', value: `*${question}*` },
          { name: 'Answer', value: result.response },
        )
        .setFooter({ text: 'Riffly Intelligent Platform' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    },
  };

  return [askCmd];
}
