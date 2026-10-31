import type { ButtonInteraction, Interaction } from 'discord.js';
import type { Command } from './commands/types.js';
import type { GuildPlayerManager } from './player/guild-player.js';
import type { LoopMode } from './player/queue.js';
import { canModifyQueue } from './commands/helpers.js';
import { RifflyError } from './errors.js';

let defaultPlayerManager: GuildPlayerManager | undefined;

/**
 * Configure default GuildPlayerManager for component interactions.
 */
export function setDefaultPlayerManager(pm: GuildPlayerManager): void {
  defaultPlayerManager = pm;
}

export function getDefaultPlayerManager(): GuildPlayerManager | undefined {
  return defaultPlayerManager;
}

/**
 * Main interaction router for Riffly.
 * Handles ChatInputCommands and Component (Button) interactions.
 */
export async function handleInteraction(
  interaction: Interaction,
  commands: ReadonlyMap<string, Command>,
  playerManager: GuildPlayerManager | undefined = defaultPlayerManager,
): Promise<void> {
  // Handle Slash Commands
  if (interaction.isChatInputCommand()) {
    await handleChatInputCommand(interaction, commands);
    return;
  }

  // Handle Button Interactions
  if (typeof interaction.isButton === 'function' && interaction.isButton()) {
    await handleButtonInteraction(interaction, playerManager);
    return;
  }
}

async function handleChatInputCommand(
  interaction: import('discord.js').ChatInputCommandInteraction,
  commands: ReadonlyMap<string, Command>,
): Promise<void> {
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

async function handleButtonInteraction(
  interaction: ButtonInteraction,
  playerManager: GuildPlayerManager | undefined,
): Promise<void> {
  const customId = interaction.customId;

  // Only handle Riffly music control buttons
  if (!customId.startsWith('riffly_')) {
    return;
  }

  if (!interaction.inGuild() || !interaction.guildId) {
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '❌ Controls can only be used in a server.',
        ephemeral: true,
      });
    }
    return;
  }

  // Validate voice channel co-location
  if (!canModifyQueue(interaction)) {
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '🔇 You must be in the same voice channel as Riffly to use this control.',
        ephemeral: true,
      });
    }
    return;
  }

  if (!playerManager) {
    console.warn(`[Interaction] Button ${customId} received but playerManager is not available.`);
    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '⚠️ Music player is not initialized.',
        ephemeral: true,
      });
    }
    return;
  }

  const guildId = interaction.guildId;

  try {
    switch (customId) {
      case 'riffly_pause': {
        await playerManager.pause(guildId);
        break;
      }
      case 'riffly_resume': {
        await playerManager.resume(guildId);
        break;
      }
      case 'riffly_skip': {
        await playerManager.skip(guildId);
        break;
      }
      case 'riffly_stop': {
        await playerManager.stop(guildId);
        break;
      }
      case 'riffly_loop': {
        const state = playerManager.getState(guildId);
        const currentMode = state.loopMode;
        const nextMode: LoopMode =
          currentMode === 'off' ? 'track' : currentMode === 'track' ? 'queue' : 'off';
        playerManager.setLoopMode(guildId, nextMode);
        break;
      }
      case 'riffly_shuffle': {
        const state = playerManager.getState(guildId);
        if (state.upcoming.length < 2) {
          if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content: '🔀 Need at least 2 tracks in the queue to shuffle.',
              ephemeral: true,
            });
          }
          return;
        }
        playerManager.shuffle(guildId);
        break;
      }
      default: {
        console.warn(`[Interaction] Unrecognized music button customId: ${customId}`);
        return;
      }
    }

    // Acknowledge button interaction
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate();
    }
  } catch (error) {
    console.error(
      `[Interaction] Error processing button ${customId}:`,
      error instanceof Error ? error.message : error,
    );

    let message: string;
    if (error instanceof RifflyError) {
      message = error.userMessage;
    } else if (error instanceof Error) {
      message = `❌ ${error.message}`;
    } else {
      message = '💥 Failed to process control.';
    }

    if (interaction.isRepliable()) {
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp({ content: message, ephemeral: true });
        } else {
          await interaction.reply({ content: message, ephemeral: true });
        }
      } catch (replyError) {
        console.error(
          '[Interaction] Failed to send button error feedback:',
          replyError instanceof Error ? replyError.message : replyError,
        );
      }
    }
  }
}
