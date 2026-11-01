import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import type { Guild, GuildMember, TextChannel } from 'discord.js';
import type { ITicketRepository, TicketData } from '../../database/types.js';

export class TicketError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TicketError';
  }
}

/**
 * Service orchestrating Discord channel lifecycles, permissions,
 * transcripts, and state tracking for support tickets.
 */
export class TicketService {
  constructor(private readonly repository: ITicketRepository) {}

  /**
   * Creates a dedicated private support ticket channel.
   */
  public async createTicket(
    guild: Guild,
    creator: GuildMember,
    categoryName = 'General Support',
    supportRoleId?: string,
  ): Promise<{ channel: TextChannel; ticket: TicketData }> {
    const existing = await this.repository.listGuildTickets(guild.id, 'open');
    const userTickets = existing.filter((t) => t.creatorId === creator.id);

    if (userTickets.length >= 3) {
      throw new TicketError('You already have 3 open tickets. Please resolve them first.');
    }

    const channelName = `ticket-${creator.user.username
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 15)}-${Date.now().toString().slice(-4)}`;

    const permissionOverwrites = [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: creator.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles,
          PermissionFlagsBits.EmbedLinks,
        ],
      },
    ];

    if (supportRoleId && guild.roles.cache.has(supportRoleId)) {
      permissionOverwrites.push({
        id: supportRoleId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      });
    }

    if (guild.members.me) {
      permissionOverwrites.push({
        id: guild.members.me.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.EmbedLinks,
        ],
      });
    }

    const channel = await guild.channels.create<ChannelType.GuildText>({
      name: channelName,
      type: ChannelType.GuildText,
      permissionOverwrites,
      topic: `Support ticket for ${creator.user.tag} (${creator.id}) | Category: ${categoryName}`,
    });

    const ticket = await this.repository.createTicket({
      guildId: guild.id,
      channelId: channel.id,
      creatorId: creator.id,
      category: categoryName,
    });

    const panelEmbed = new EmbedBuilder()
      .setTitle(`🎫 Support Ticket: ${categoryName}`)
      .setColor(0x6366f1)
      .setDescription(
        `Welcome <@${creator.id}>!\nSupport staff will be with you shortly. Please describe your inquiry with as much detail as possible.`,
      )
      .addFields(
        { name: 'Ticket ID', value: `\`${ticket.id}\``, inline: true },
        { name: 'Category', value: categoryName, inline: true },
        { name: 'Created By', value: `<@${creator.id}>`, inline: true },
      )
      .setTimestamp();

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('riffly_ticket_close')
        .setLabel('Close Ticket')
        .setEmoji('🔒')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId('riffly_ticket_claim')
        .setLabel('Claim Ticket')
        .setEmoji('🙋')
        .setStyle(ButtonStyle.Primary),
    );

    await channel.send({ embeds: [panelEmbed], components: [buttons] });

    return { channel, ticket };
  }

  /**
   * Closes an active ticket and records the resolution timestamp.
   */
  public async closeTicket(channel: TextChannel, moderator: GuildMember): Promise<TicketData> {
    const ticket = await this.repository.getTicketByChannel(channel.guild.id, channel.id);
    if (!ticket) {
      throw new TicketError('This channel is not an active support ticket.');
    }

    if (ticket.status === 'closed') {
      throw new TicketError('Ticket is already closed.');
    }

    const closed = await this.repository.closeTicket(ticket.id);
    if (!closed) {
      throw new TicketError('Failed to update ticket status in database.');
    }

    const closeEmbed = new EmbedBuilder()
      .setTitle('🔒 Ticket Closed')
      .setColor(0xef4444)
      .setDescription(
        `Ticket closed by <@${moderator.id}>.\nThis channel will be archived or removed shortly.`,
      )
      .setTimestamp();

    await channel.send({ embeds: [closeEmbed] });

    // Update permissions so creator can no longer send messages
    await channel.permissionOverwrites.edit(ticket.creatorId, {
      [PermissionFlagsBits.SendMessages.toString()]: false,
    });

    return closed;
  }

  /**
   * Claims a ticket on behalf of a staff moderator.
   */
  public async claimTicket(channel: TextChannel, moderator: GuildMember): Promise<TicketData> {
    const ticket = await this.repository.getTicketByChannel(channel.guild.id, channel.id);
    if (!ticket) {
      throw new TicketError('This channel is not an active support ticket.');
    }

    if (ticket.claimedBy) {
      throw new TicketError(`Ticket is already claimed by <@${ticket.claimedBy}>.`);
    }

    const claimed = await this.repository.claimTicket(ticket.id, moderator.id);
    if (!claimed) {
      throw new TicketError('Failed to claim ticket in database.');
    }

    const claimEmbed = new EmbedBuilder()
      .setTitle('🙋 Ticket Claimed')
      .setColor(0x10b981)
      .setDescription(`This ticket has been claimed by <@${moderator.id}>.`)
      .setTimestamp();

    await channel.send({ embeds: [claimEmbed] });
    return claimed;
  }

  /**
   * Releases claim on an active ticket.
   */
  public async unclaimTicket(channel: TextChannel, moderator: GuildMember): Promise<TicketData> {
    const ticket = await this.repository.getTicketByChannel(channel.guild.id, channel.id);
    if (!ticket) {
      throw new TicketError('This channel is not an active support ticket.');
    }

    if (!ticket.claimedBy) {
      throw new TicketError('This ticket is not currently claimed.');
    }

    const unclaimed = await this.repository.unclaimTicket(ticket.id);
    if (!unclaimed) {
      throw new TicketError('Failed to unclaim ticket in database.');
    }

    const unclaimEmbed = new EmbedBuilder()
      .setTitle('🔓 Ticket Unclaimed')
      .setColor(0xf59e0b)
      .setDescription(
        `Ticket has been unclaimed by <@${moderator.id}> and is open for support staff.`,
      )
      .setTimestamp();

    await channel.send({ embeds: [unclaimEmbed] });
    return unclaimed;
  }

  /**
   * Renames a ticket channel.
   */
  public async renameTicket(channel: TextChannel, newName: string): Promise<void> {
    const ticket = await this.repository.getTicketByChannel(channel.guild.id, channel.id);
    if (!ticket) {
      throw new TicketError('This channel is not an active support ticket.');
    }

    await channel.setName(newName.toLowerCase().replace(/\s+/g, '-'));
  }

  /**
   * Lists all open tickets in the guild.
   */
  public async listTickets(guildId: string): Promise<TicketData[]> {
    return this.repository.listGuildTickets(guildId, 'open');
  }

  /**
   * Sends an interactive ticket creation panel to a designated channel.
   */
  public async sendPanel(
    channel: TextChannel,
    title: string,
    description: string,
    buttonText = 'Open Ticket',
  ): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(description)
      .setColor(0x6366f1)
      .setFooter({ text: 'Riffly Support System' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('riffly_ticket_create')
        .setLabel(buttonText)
        .setEmoji('📩')
        .setStyle(ButtonStyle.Primary),
    );

    await channel.send({ embeds: [embed], components: [row] });
  }

  /**
   * Exports a structured text transcript of the ticket conversation.
   */
  public async exportTranscript(channel: TextChannel): Promise<string> {
    const messages = await channel.messages.fetch({ limit: 100 });
    const ordered = Array.from(messages.values()).reverse();

    const lines = [
      `============================================================`,
      `RIFFLY TICKET TRANSCRIPT`,
      `Channel: #${channel.name} (${channel.id})`,
      `Exported: ${new Date().toISOString()}`,
      `Total Messages: ${ordered.length}`,
      `============================================================`,
      '',
    ];

    for (const msg of ordered) {
      const time = msg.createdAt.toISOString();
      const author = `${msg.author.tag} (${msg.author.id})`;
      const content = msg.content || '[No text content / embed / attachment]';
      lines.push(`[${time}] ${author}: ${content}`);
    }

    return lines.join('\n');
  }

  /**
   * Adds an additional user to the ticket channel.
   */
  public async addMember(channel: TextChannel, member: GuildMember): Promise<void> {
    await channel.permissionOverwrites.edit(member.id, {
      [PermissionFlagsBits.ViewChannel.toString()]: true,
      [PermissionFlagsBits.SendMessages.toString()]: true,
      [PermissionFlagsBits.ReadMessageHistory.toString()]: true,
    });
  }

  /**
   * Removes a user from the ticket channel.
   */
  public async removeMember(channel: TextChannel, member: GuildMember): Promise<void> {
    await channel.permissionOverwrites.delete(member.id);
  }
}
