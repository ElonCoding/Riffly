import {
  AttachmentBuilder,
  EmbedBuilder,
  GuildMember,
  SlashCommandBuilder,
} from 'discord.js';
import type { TextChannel } from 'discord.js';
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
          .setName('create')
          .setDescription('Create a new private support ticket channel.')
          .addStringOption((opt) =>
            opt
              .setName('category')
              .setDescription('Ticket category/topic')
              .setRequired(false),
          ),
      )
      .addSubcommand((sub) =>
        sub.setName('close').setDescription('Close the current ticket channel.'),
      )
      .addSubcommand((sub) =>
        sub.setName('claim').setDescription('Claim the current ticket as support staff.'),
      )
      .addSubcommand((sub) =>
        sub
          .setName('add')
          .setDescription('Add a user to this ticket.')
          .addUserOption((opt) =>
            opt.setName('user').setDescription('User to add').setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName('remove')
          .setDescription('Remove a user from this ticket.')
          .addUserOption((opt) =>
            opt.setName('user').setDescription('User to remove').setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub.setName('transcript').setDescription('Generate a text transcript of this ticket.'),
      ),
    guildOnly: true,
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: true });
      const guild = interaction.guild;
      const member = interaction.member;

      if (!guild || !member || !(member instanceof GuildMember)) {
        await interaction.editReply({ content: 'Command can only be run in a server.' });
        return;
      }

      const subcommand = interaction.options.getSubcommand();

      try {
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

        if (subcommand === 'add') {
          const targetUser = interaction.options.getUser('user', true);
          const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
          if (!targetMember) {
            await interaction.editReply({ content: 'User is not in this server.' });
            return;
          }
          await service.addMember(textChannel, targetMember);
          await interaction.editReply({ content: `Added <@${targetUser.id}> to this ticket.` });
          return;
        }

        if (subcommand === 'remove') {
          const targetUser = interaction.options.getUser('user', true);
          const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
          if (!targetMember) {
            await interaction.editReply({ content: 'User is not in this server.' });
            return;
          }
          await service.removeMember(textChannel, targetMember);
          await interaction.editReply({ content: `Removed <@${targetUser.id}> from this ticket.` });
          return;
        }

        if (subcommand === 'transcript') {
          const transcriptText = await service.exportTranscript(textChannel);
          const buffer = Buffer.from(transcriptText, 'utf-8');
          const attachment = new AttachmentBuilder(buffer, {
            name: `transcript-${textChannel.name}.txt`,
          });
          const embed = new EmbedBuilder()
            .setTitle('📄 Ticket Transcript Export')
            .setColor(0x6366f1)
            .setDescription(`Transcript generated for <#${textChannel.id}>`)
            .setTimestamp();

          await interaction.editReply({ embeds: [embed], files: [attachment] });
          return;
        }
      } catch (err: unknown) {
        await interaction.editReply({
          content: `Error: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    },
  };

  return [ticketCommand];
}
