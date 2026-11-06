import {
  ActionRowBuilder,
  ButtonBuilder,
  GuildMember,
  GuildMemberRoleManager,
  type ButtonInteraction,
  type Interaction,
  type StringSelectMenuInteraction,
  type TextChannel,
} from 'discord.js';
import type { Command } from './commands/types.js';
import type { GuildPlayerManager } from './player/guild-player.js';
import type { LoopMode } from './player/queue.js';
import { canModifyQueue } from './commands/helpers.js';
import { RifflyError } from './errors.js';
import { getPrismaClient } from './database/client.js';
import { TicketRepository } from './database/repositories/ticket-repository.js';
import { TicketService } from './modules/tickets/service.js';
import { GiveawayRepository } from './database/repositories/giveaway-repository.js';
import { GiveawayService } from './modules/giveaways/service.js';
import {
  buildHelpOverviewEmbed,
  buildHelpMainEmbed,
  buildHelpExtraEmbed,
  buildHelpCategoryEmbed,
  buildHelpActionRows,
} from './modules/utility/help-menu.js';

let defaultPlayerManager: GuildPlayerManager | undefined;

const MUSIC_BUTTONS = new Set([
  'riffly_pause',
  'riffly_resume',
  'riffly_skip',
  'riffly_stop',
  'riffly_loop',
  'riffly_shuffle',
  'riffly_previous',
  'riffly_like',
]);

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

  // Handle Select Menu Interactions
  if (typeof interaction.isStringSelectMenu === 'function' && interaction.isStringSelectMenu()) {
    await handleSelectMenuInteraction(interaction);
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

  // Only handle Riffly interactive buttons
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

  // 0. Handle Help Menu Buttons fallback
  if (
    customId === 'riffly_help_main' ||
    customId === 'riffly_help_extra' ||
    customId === 'riffly_help_overview'
  ) {
    let embed;
    let tab = 'overview';
    if (customId === 'riffly_help_main') {
      tab = 'main';
      embed = buildHelpMainEmbed(interaction.user, interaction.client);
    } else if (customId === 'riffly_help_extra') {
      tab = 'extra';
      embed = buildHelpExtraEmbed(interaction.user, interaction.client);
    } else {
      embed = buildHelpOverviewEmbed(interaction.user, interaction.client);
    }
    await interaction.update({
      embeds: [embed],
      components: buildHelpActionRows(tab),
    });
    return;
  }

  // 1. Handle Verification Button
  if (customId === 'riffly_verify_btn') {
    const guildId = interaction.guildId;
    const member = interaction.member;
    if (!member || !(member instanceof GuildMember)) {
      await interaction.reply({ content: '❌ Cannot resolve guild member.', ephemeral: true });
      return;
    }
    const prisma = getPrismaClient();
    const setting = await prisma.verificationSetting.findUnique({ where: { guildId } });
    if (!setting || !setting.roleId) {
      await interaction.reply({
        content: '❌ Verification role is not configured for this server.',
        ephemeral: true,
      });
      return;
    }
    if (member.roles instanceof GuildMemberRoleManager && member.roles.cache.has(setting.roleId)) {
      await interaction.reply({
        content: 'ℹ️ You are already verified on this server.',
        ephemeral: true,
      });
      return;
    }
    try {
      await member.roles.add(setting.roleId);
      await interaction.reply({
        content: '✅ You have been successfully verified! Welcome to the server.',
        ephemeral: true,
      });
    } catch {
      await interaction.reply({
        content: '❌ Failed to assign verified role. Please check role hierarchy.',
        ephemeral: true,
      });
    }
    return;
  }

  // 2. Handle Ticket Buttons
  if (customId === 'riffly_ticket_create') {
    await interaction.deferReply({ ephemeral: true });
    const guild = interaction.guild;
    const member = interaction.member;
    if (!guild || !member || !(member instanceof GuildMember)) {
      await interaction.editReply({ content: '❌ Command can only be executed in a server.' });
      return;
    }
    try {
      const ticketRepo = new TicketRepository();
      const ticketService = new TicketService(ticketRepo);
      const ticketResult = await ticketService.createTicket(guild, member, 'Support Request');
      await interaction.editReply({
        content: `✅ Ticket opened! Head over to <#${ticketResult.channel.id}>.`,
      });
    } catch (err: unknown) {
      await interaction.editReply({
        content: `❌ Failed to open ticket: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
    return;
  }

  if (customId === 'riffly_ticket_close') {
    await interaction.deferReply({ ephemeral: true });
    const channel = interaction.channel;
    const member = interaction.member;
    if (!channel || !('bulkDelete' in channel) || !member || !(member instanceof GuildMember)) {
      await interaction.editReply({ content: '❌ Can only close within a ticket channel.' });
      return;
    }
    try {
      const ticketRepo = new TicketRepository();
      const ticketService = new TicketService(ticketRepo);
      await ticketService.closeTicket(channel as TextChannel, member);
      await interaction.editReply({ content: '🔒 Ticket has been successfully closed.' });
    } catch (err: unknown) {
      await interaction.editReply({
        content: `❌ Failed to close ticket: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
    return;
  }

  if (customId === 'riffly_ticket_claim') {
    await interaction.deferReply({ ephemeral: false });
    const channel = interaction.channel;
    const member = interaction.member;
    if (!channel || !('bulkDelete' in channel) || !member || !(member instanceof GuildMember)) {
      await interaction.editReply({ content: '❌ Can only claim within a ticket channel.' });
      return;
    }
    try {
      const ticketRepo = new TicketRepository();
      const ticketService = new TicketService(ticketRepo);
      await ticketService.claimTicket(channel as TextChannel, member);
      await interaction.editReply({ content: `🙋 <@${member.id}> has claimed this ticket.` });
    } catch (err: unknown) {
      await interaction.editReply({
        content: `❌ Failed to claim ticket: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
    return;
  }

  // 3. Handle Suggestion Voting
  if (customId === 'riffly_suggest_up' || customId === 'riffly_suggest_down') {
    try {
      const message = interaction.message;
      const firstRow = message.components[0] as
        { components?: Array<{ label?: string }> } | undefined;
      if (firstRow?.components && firstRow.components.length >= 2) {
        const row = ActionRowBuilder.from(message.components[0] as never);
        const upBtn = row.components[0] as ButtonBuilder;
        const downBtn = row.components[1] as ButtonBuilder;

        const upLabel = (upBtn.data as { label?: string }).label ?? '';
        const downLabel = (downBtn.data as { label?: string }).label ?? '';

        const upMatch = /Upvote \((\d+)\)/.exec(upLabel);
        const downMatch = /Downvote \((\d+)\)/.exec(downLabel);
        let upCount = parseInt(upMatch?.[1] ?? '0', 10);
        let downCount = parseInt(downMatch?.[1] ?? '0', 10);

        if (customId === 'riffly_suggest_up') upCount++;
        else downCount++;

        upBtn.setLabel(`Upvote (${upCount})`);
        downBtn.setLabel(`Downvote (${downCount})`);

        await message.edit({ components: [row as never] });
        await interaction.reply({
          content: `🗳️ Vote registered! Current: 👍 ${upCount} / 👎 ${downCount}`,
          ephemeral: true,
        });
        return;
      }
    } catch {
      await interaction.reply({ content: '❌ Failed to record suggestion vote.', ephemeral: true });
      return;
    }
  }

  // 4. Handle Giveaway Entry
  if (customId === 'riffly_giveaway_enter') {
    const giveawayRepo = new GiveawayRepository();
    const giveawayService = new GiveawayService(giveawayRepo);
    await giveawayService.handleEntryInteraction(interaction);
    return;
  }

  // 5. Music player control buttons
  if (MUSIC_BUTTONS.has(customId)) {
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
        case 'riffly_previous': {
          if (typeof playerManager.seek === 'function') {
            await playerManager.seek(guildId, 0);
          }
          break;
        }
        case 'riffly_like': {
          const state = playerManager.getState(guildId);
          const songTitle = state.current?.title ?? 'Current track';
          if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content: `❤️ Added **${songTitle}** to your Liked Songs!`,
              ephemeral: true,
            });
          }
          return;
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
}

async function handleSelectMenuInteraction(
  interaction: StringSelectMenuInteraction,
): Promise<void> {
  const customId = interaction.customId;
  if (customId === 'riffly_help_select') {
    const selected = interaction.values[0];
    const tab = selected ?? 'overview';
    let embed;
    if (selected === 'overview') {
      embed = buildHelpOverviewEmbed(interaction.user, interaction.client);
    } else if (selected) {
      embed = buildHelpCategoryEmbed(interaction.user, interaction.client, selected);
    } else {
      embed = buildHelpOverviewEmbed(interaction.user, interaction.client);
    }
    await interaction.update({
      embeds: [embed],
      components: buildHelpActionRows(tab),
    });
    return;
  }

  if (customId === 'riffly_queue_select') {
    const value = interaction.values[0];
    if (!value || value === 'queue_empty') {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate();
      }
      return;
    }

    if (!canModifyQueue(interaction)) {
      await interaction.reply({
        content: '🔇 You must be in the same voice channel as Riffly to use this control.',
        ephemeral: true,
      });
      return;
    }

    if (value.startsWith('skip_to_') && defaultPlayerManager && interaction.guildId) {
      const idx = parseInt(value.replace('skip_to_', ''), 10);
      if (!isNaN(idx)) {
        for (let i = 0; i < idx; i++) {
          defaultPlayerManager.remove(interaction.guildId, 0);
        }
        await defaultPlayerManager.skip(interaction.guildId);
        await interaction.reply({
          content: '⏭️ Skipped forward in queue!',
          ephemeral: true,
        });
        return;
      }
    }

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate();
    }
    return;
  }

  if (customId === 'riffly_more_features') {
    const feature = interaction.values[0];
    if (!feature || !defaultPlayerManager || !interaction.guildId) {
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate();
      }
      return;
    }

    if (!canModifyQueue(interaction)) {
      await interaction.reply({
        content: '🔇 You must be in the same voice channel as Riffly to use this control.',
        ephemeral: true,
      });
      return;
    }

    const guildId = interaction.guildId;
    switch (feature) {
      case 'feature_shuffle': {
        defaultPlayerManager.shuffle(guildId);
        await interaction.reply({ content: '🔀 Queue shuffled!', ephemeral: true });
        return;
      }
      case 'feature_loop_track': {
        defaultPlayerManager.setLoopMode(guildId, 'track');
        await interaction.reply({ content: '🔂 Loop mode: **Track**', ephemeral: true });
        return;
      }
      case 'feature_loop_queue': {
        defaultPlayerManager.setLoopMode(guildId, 'queue');
        await interaction.reply({ content: '🔁 Loop mode: **Queue**', ephemeral: true });
        return;
      }
      case 'feature_loop_off': {
        defaultPlayerManager.setLoopMode(guildId, 'off');
        await interaction.reply({ content: '➡️ Loop mode: **Off**', ephemeral: true });
        return;
      }
      case 'feature_clear': {
        defaultPlayerManager.clear(guildId);
        await interaction.reply({ content: '🗑️ Upcoming queue cleared!', ephemeral: true });
        return;
      }
      case 'feature_autoplay': {
        const current = defaultPlayerManager.isAutoplay(guildId);
        defaultPlayerManager.setAutoplay(guildId, !current);
        await interaction.reply({
          content: !current ? '📻 Autoplay enabled!' : '📻 Autoplay disabled.',
          ephemeral: true,
        });
        return;
      }
      case 'feature_bassboost':
      case 'feature_nightcore':
      case 'feature_8d':
      case 'feature_vaporwave': {
        const preset = feature.replace('feature_', '') as import('./audio/types.js').AudioFilterPreset;
        await defaultPlayerManager.setFilter(guildId, preset);
        await interaction.reply({ content: `🎛️ Audio filter set to **${preset}**!`, ephemeral: true });
        return;
      }
      case 'feature_lyrics': {
        const state = defaultPlayerManager.getState(guildId);
        const track = state.current;
        if (track) {
          await interaction.reply({
            content: `📜 Search for lyrics with \`/lyrics title:${track.title.slice(0, 50)}\``,
            ephemeral: true,
          });
        } else {
          await interaction.reply({ content: '⏹️ Nothing is currently playing.', ephemeral: true });
        }
        return;
      }
    }

    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate();
    }
  }
}
