import {
  AttachmentBuilder,
  ChannelType,
  EmbedBuilder,
  GuildMember,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type TextChannel,
} from 'discord.js';
import type { CommandDefinition } from '../core/types.js';
import type { TicketService } from './service.js';

export function createTicketCommands(service: TicketService): CommandDefinition[] {
  const ticketCommand: CommandDefinition = {
    name: 'ticket',
    description: 'Manage support tickets and channel access.',
    data: new SlashCommandBuilder()
      .setName('ticket')
      .setDescription('Manage support tickets and channel access.')
      .addSubcommand((sub) =>
        sub
          .setName('setup')
          .setDescription('Configure ticket category and default support roles')
          .addChannelOption((opt) =>
            opt.setName('category').setDescription('Parent category for new tickets').addChannelTypes(ChannelType.GuildCategory).setRequired(true),
          )
          .addRoleOption((opt) => opt.setName('support_role').setDescription('Role granted access to all tickets'))
          .addChannelOption((opt) =>
            opt.setName('transcripts_channel').setDescription('Channel for saved transcripts').addChannelTypes(ChannelType.GuildText),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName('panel')
          .setDescription('Send a ticket creation panel to a channel')
          .addChannelOption((opt) =>
            opt.setName('channel').setDescription('Target text channel').addChannelTypes(ChannelType.GuildText).setRequired(true),
          )
          .addStringOption((opt) => opt.setName('title').setDescription('Panel title').setRequired(true))
          .addStringOption((opt) => opt.setName('description').setDescription('Panel instructions').setRequired(true))
          .addStringOption((opt) => opt.setName('button_text').setDescription('Custom button label')),
      )
      .addSubcommand((sub) =>
        sub
          .setName('create')
          .setDescription('Create a new private support ticket channel.')
          .addStringOption((opt) => opt.setName('category').setDescription('Ticket category/topic')),
      )
      .addSubcommand((sub) =>
        sub
          .setName('close')
          .setDescription('Close the current ticket channel.')
          .addStringOption((opt) => opt.setName('reason').setDescription('Closure reason')),
      )
      .addSubcommand((sub) => sub.setName('claim').setDescription('Claim the current ticket as support staff.'))
      .addSubcommand((sub) => sub.setName('unclaim').setDescription('Release your claim on this ticket.'))
      .addSubcommand((sub) =>
        sub
          .setName('add')
          .setDescription('Add a user to this ticket.')
          .addUserOption((opt) => opt.setName('user').setDescription('User to add').setRequired(true)),
      )
      .addSubcommand((sub) =>
        sub
          .setName('remove')
          .setDescription('Remove a user from this ticket.')
          .addUserOption((opt) => opt.setName('user').setDescription('User to remove').setRequired(true)),
      )
      .addSubcommand((sub) =>
        sub
          .setName('rename')
          .setDescription('Rename the current ticket channel.')
          .addStringOption((opt) => opt.setName('name').setDescription('New channel name').setRequired(true)),
      )
      .addSubcommand((sub) => sub.setName('list').setDescription('List all currently open support tickets.'))
      .addSubcommand((sub) => sub.setName('transcript').setDescription('Generate a text transcript of this ticket.')),
    guildOnly: true,
    execute: async (interaction: ChatInputCommandInteraction) => {
      await interaction.deferReply({ ephemeral: true });
      const guild = interaction.guild;
      const member = interaction.member;

      if (!guild || !member || !(member instanceof GuildMember)) {
        await interaction.editReply({ content: 'Command can only be run in a server.' });
        return;
      }

      const subcommand = interaction.options.getSubcommand();

      try {
        if (subcommand === 'setup') {
          if (!member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            await interaction.editReply({ content: 'You need Manage Server permissions to setup tickets.' });
            return;
          }
          const cat = interaction.options.getChannel('category', true);
          const role = interaction.options.getRole('support_role');
          const trans = interaction.options.getChannel('transcripts_channel');

          await interaction.editReply(
            `✅ **Ticket system configured.**\n• Category: **${cat.name}**\n• Support Role: ${role ? `<@&${role.id}>` : '*None*'}\n• Transcripts: ${trans ? `<#${trans.id}>` : '*None*'}`,
          );
          return;
        }

        if (subcommand === 'panel') {
          if (!member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            await interaction.editReply({ content: 'You need Manage Server permissions to send panels.' });
            return;
          }
          const targetChan = interaction.options.getChannel<ChannelType.GuildText>('channel', true);
          const title = interaction.options.getString('title', true);
          const desc = interaction.options.getString('description', true);
          const btn = interaction.options.getString('button_text') ?? 'Open Ticket';

          await service.sendPanel(targetChan, title, desc, btn);
          await interaction.editReply(`✅ Ticket panel dispatched to <#${targetChan.id}>.`);
          return;
        }

        if (subcommand === 'list') {
          const tickets = await service.listTickets(guild.id);
          if (tickets.length === 0) {
            await interaction.editReply('There are no open support tickets right now.');
            return;
          }

          const embed = new EmbedBuilder()
            .setTitle(`🎫 Open Tickets (${tickets.length})`)
            .setColor(0x6366f1)
            .setDescription(
              tickets
                .map(
                  (t) =>
                    `• <#${t.channelId}> — User: <@${t.creatorId}> | Claimed: ${t.claimedBy ? `<@${t.claimedBy}>` : '*Unclaimed*'}`,
                )
                .join('\n'),
            );
          await interaction.editReply({ embeds: [embed] });
          return;
        }

        if (subcommand === 'create') {
          const category = interaction.options.getString('category') ?? 'General Support';
          const { channel } = await service.createTicket(guild, member, category);
          await interaction.editReply({
            content: `🎫 Ticket created! Head over to <#${channel.id}> to speak with staff.`,
          });
          return;
        }

        const channel = interaction.channel;
        if (!channel || !('guild' in channel) || !('permissionOverwrites' in channel)) {
          await interaction.editReply({ content: 'Must be run inside a guild text channel.' });
          return;
        }

        const textChannel = channel as TextChannel;

        if (subcommand === 'close') {
          await service.closeTicket(textChannel, member);
          await interaction.editReply({ content: 'Ticket has been marked closed.' });
          return;
        }

        if (subcommand === 'claim') {
          await service.claimTicket(textChannel, member);
          await interaction.editReply({ content: 'You have claimed this ticket.' });
          return;
        }

        if (subcommand === 'unclaim') {
          await service.unclaimTicket(textChannel, member);
          await interaction.editReply({ content: 'You have unclaimed this ticket.' });
          return;
        }

        if (subcommand === 'rename') {
          const newName = interaction.options.getString('name', true);
          await service.renameTicket(textChannel, newName);
          await interaction.editReply({ content: `✅ Ticket renamed to #${newName.toLowerCase().replace(/\s+/g, '-')}.` });
          return;
        }

        if (subcommand === 'add') {
          const targetUser = interaction.options.getUser('user', true);
          const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
          if (!targetMember) {
            await interaction.editReply({ content: 'Could not find that member in this server.' });
            return;
          }
          await service.addMember(textChannel, targetMember);
          await interaction.editReply({ content: `Added <@${targetMember.id}> to the ticket.` });
          return;
        }

        if (subcommand === 'remove') {
          const targetUser = interaction.options.getUser('user', true);
          const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
          if (!targetMember) {
            await interaction.editReply({ content: 'Could not find that member in this server.' });
            return;
          }
          await service.removeMember(textChannel, targetMember);
          await interaction.editReply({ content: `Removed <@${targetMember.id}> from the ticket.` });
          return;
        }

        if (subcommand === 'transcript') {
          const transcript = await service.exportTranscript(textChannel);
          const buffer = Buffer.from(transcript, 'utf-8');
          const attachment = new AttachmentBuilder(buffer, {
            name: `${textChannel.name}-transcript.txt`,
          });
          await interaction.editReply({
            content: '📄 Here is the transcript for this ticket:',
            files: [attachment],
          });
          return;
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown ticket error occurred.';
        await interaction.editReply({ content: `❌ ${message}` });
      }
    },
  };

  return [ticketCommand];
}
