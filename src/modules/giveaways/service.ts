import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import type { ButtonInteraction, Client, TextChannel } from 'discord.js';
import type { IGiveawayRepository, GiveawayData } from '../../database/types.js';
import type { TaskScheduler } from '../../scheduler/task-scheduler.js';
import type { EndGiveawayResult, StartGiveawayOptions } from './types.js';

/**
 * Service managing giveaway creation, interactive button entries, timed conclusions, and rerolls.
 */
export class GiveawayService {
  constructor(
    private readonly repository: IGiveawayRepository,
    private readonly scheduler?: TaskScheduler,
    private readonly client?: Client,
  ) {
    if (this.scheduler) {
      this.scheduler.registerHandler<{ messageId?: string }>('giveaway.end', async (payload) => {
        const messageId = payload.messageId;
        if (messageId) {
          await this.endGiveaway(messageId);
        }
      });
    }
  }

  /**
   * Starts a new giveaway and posts the interactive panel.
   */
  public async startGiveaway(
    channel: TextChannel,
    options: StartGiveawayOptions,
  ): Promise<GiveawayData> {
    const endsAt = new Date(Date.now() + options.durationMs);

    const embed = new EmbedBuilder()
      .setTitle(`🎉 GIVEAWAY: ${options.prize}`)
      .setColor(0x8b5cf6)
      .setDescription(
        `Click the button below to enter!\n\n` +
          `**Winners:** ${options.winnersCount}\n` +
          `**Hosted by:** <@${options.hostId}>\n` +
          `**Entries:** 0\n` +
          `**Ends:** <t:${Math.floor(endsAt.getTime() / 1000)}:R>`,
      )
      .setFooter({ text: 'Riffly Giveaways' })
      .setTimestamp(endsAt);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('riffly_giveaway_enter')
        .setLabel('🎉 Enter (0)')
        .setStyle(ButtonStyle.Primary),
    );

    const message = await channel.send({ embeds: [embed], components: [row] });

    const giveaway = await this.repository.createGiveaway({
      guildId: options.guildId,
      channelId: channel.id,
      messageId: message.id,
      prize: options.prize,
      winnersCount: options.winnersCount,
      hostId: options.hostId,
      endsAt,
    });

    if (this.scheduler) {
      await this.scheduler.scheduleTask({
        guildId: options.guildId,
        taskType: 'giveaway.end',
        payload: { messageId: message.id, channelId: channel.id },
        executeAt: endsAt,
      });
    }

    return giveaway;
  }

  /**
   * Handles user clicking the enter giveaway button.
   */
  public async handleEntryInteraction(interaction: ButtonInteraction): Promise<void> {
    const messageId = interaction.message.id;
    const userId = interaction.user.id;

    const giveaway = await this.repository.getGiveaway(messageId);
    if (!giveaway) {
      await interaction.reply({ content: '❌ Giveaway not found.', ephemeral: true });
      return;
    }

    if (giveaway.ended) {
      await interaction.reply({ content: '❌ This giveaway has already ended.', ephemeral: true });
      return;
    }

    let responseMessage: string;
    let newCount: number;

    if (giveaway.entries.includes(userId)) {
      const result = await this.repository.removeEntry(messageId, userId);
      newCount = result.totalEntries;
      responseMessage = '👋 You have left the giveaway.';
    } else {
      const result = await this.repository.addEntry(messageId, userId);
      newCount = result.totalEntries;
      responseMessage = '🎉 You entered the giveaway! Good luck!';
    }

    // Update button label with new entries count
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('riffly_giveaway_enter')
        .setLabel(`🎉 Enter (${newCount})`)
        .setStyle(ButtonStyle.Primary),
    );

    // Update embed entries field
    const oldEmbed = interaction.message.embeds[0];
    if (oldEmbed) {
      const updatedEmbed = EmbedBuilder.from(oldEmbed).setDescription(
        `Click the button below to enter!\n\n` +
          `**Winners:** ${giveaway.winnersCount}\n` +
          `**Hosted by:** <@${giveaway.hostId}>\n` +
          `**Entries:** ${newCount}\n` +
          `**Ends:** <t:${Math.floor(giveaway.endsAt.getTime() / 1000)}:R>`,
      );

      await interaction.message
        .edit({ embeds: [updatedEmbed], components: [row] })
        .catch(() => null);
    }

    await interaction.reply({ content: responseMessage, ephemeral: true });
  }

  /**
   * Finalizes a giveaway, picks winners, and updates Discord embed.
   */
  public async endGiveaway(messageId: string): Promise<EndGiveawayResult | null> {
    const giveaway = await this.repository.getGiveaway(messageId);
    if (!giveaway || giveaway.ended) return null;

    const winners = this.pickWinners(giveaway.entries, giveaway.winnersCount);
    const updated = await this.repository.endGiveaway(messageId, winners);

    await this.updateGiveawayMessage(updated, winners);

    return { giveaway: updated, winners };
  }

  /**
   * Rerolls winners for an ended giveaway.
   */
  public async rerollGiveaway(messageId: string): Promise<string[]> {
    const giveaway = await this.repository.getGiveaway(messageId);
    if (!giveaway || !giveaway.ended) return [];

    const winners = this.pickWinners(giveaway.entries, giveaway.winnersCount);
    await this.repository.endGiveaway(messageId, winners);
    await this.updateGiveawayMessage(giveaway, winners, true);

    return winners;
  }

  /**
   * Randomly selects unique winners from the participant list.
   */
  public pickWinners(entries: string[], count: number): string[] {
    if (entries.length === 0) return [];
    const pool = [...entries];
    const winners: string[] = [];

    const max = Math.min(count, pool.length);
    for (let i = 0; i < max; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      const chosen = pool.splice(idx, 1)[0];
      if (chosen) {
        winners.push(chosen);
      }
    }

    return winners;
  }

  /**
   * Updates message embed and posts announcement in the channel.
   */
  private async updateGiveawayMessage(
    giveaway: GiveawayData,
    winners: string[],
    isReroll = false,
  ): Promise<void> {
    if (!this.client) return;

    try {
      const channel = (await this.client.channels.fetch(giveaway.channelId)) as TextChannel | null;
      if (!channel || !('messages' in channel)) return;

      const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
      if (!message) return;

      const winnersText =
        winners.length > 0 ? winners.map((id) => `<@${id}>`).join(', ') : 'No valid entries';

      const embed = new EmbedBuilder()
        .setTitle(`🎉 GIVEAWAY ENDED: ${giveaway.prize}`)
        .setColor(0x10b981)
        .setDescription(
          `**Winner(s):** ${winnersText}\n` +
            `**Hosted by:** <@${giveaway.hostId}>\n` +
            `**Total Entries:** ${giveaway.entries.length}`,
        )
        .setFooter({ text: 'Riffly Giveaways • Concluded' })
        .setTimestamp();

      const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('riffly_giveaway_ended')
          .setLabel(`Ended (${giveaway.entries.length} Entries)`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
      );

      await message.edit({ embeds: [embed], components: [disabledRow] }).catch(() => null);

      if (winners.length > 0) {
        const prefix = isReroll ? '🔄 **Reroll!**' : '🎉 **Congratulations**';
        await channel
          .send({
            content: `${prefix} ${winnersText}! You won **${giveaway.prize}**!`,
          })
          .catch(() => null);
      } else {
        await channel
          .send({
            content: `⚠️ Giveaway for **${giveaway.prize}** ended with no valid entries.`,
          })
          .catch(() => null);
      }
    } catch {
      // Channel or message fetch error ignored gracefully
    }
  }
}
