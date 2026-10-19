import type { Interaction } from 'discord.js';
import type { Command } from './commands/types.js';

export async function handleInteraction(
  interaction: Interaction,
  commands: ReadonlyMap<string, Command>,
): Promise<void> {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  const command = commands.get(interaction.commandName);
  if (!command) {
    console.warn(`[Interaction] Unknown command received: ${interaction.commandName}`);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: 'Unknown command.',
        ephemeral: true,
      });
    }
    return;
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(
      `[Interaction] Error executing /${interaction.commandName}:`,
      error instanceof Error ? error.message : error,
    );

    const errorMessage = 'There was an error while executing this command.';
    if (interaction.isRepliable()) {
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: errorMessage, ephemeral: true });
        } else {
          await interaction.reply({ content: errorMessage, ephemeral: true });
        }
      } catch (replyError) {
        console.error(
          '[Interaction] Failed to send error feedback:',
          replyError instanceof Error ? replyError.message : replyError,
        );
      }
    }
  }
}
