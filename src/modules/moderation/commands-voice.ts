/**
 * Voice moderation commands: move member and mass moveall.
 */

import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { CommandDefinition } from '../core/types.js';
import type { ModerationService } from './service.js';

export function createVoiceModerationCommands(service: ModerationService): CommandDefinition[] {
  const moveCmd: CommandDefinition = {
    name: 'move',
    description: 'Move a member or all members to another voice channel.',
    data: new SlashCommandBuilder()
      .setName('move')
      .setDescription('Move voice members.')
      .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers)
      .addSubcommand((sub) =>
        sub
          .setName('member')
          .setDescription('Move a specific member to a voice channel.')
          .addUserOption((opt) => opt.setName('user').setDescription('Target member').setRequired(true))
          .addChannelOption((opt) =>
            opt
              .setName('destination')
              .setDescription('Destination voice channel')
              .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
              .setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName('all')
          .setDescription('Move all members from one voice channel to another.')
          .addChannelOption((opt) =>
            opt
              .setName('destination')
              .setDescription('Destination voice channel')
              .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
              .setRequired(true),
          )
          .addChannelOption((opt) =>
            opt
              .setName('source')
              .setDescription('Source voice channel (defaults to all connected members)')
              .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
              .setRequired(false),
          ),
      ),
    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({ content: '❌ Guild only.', ephemeral: true });
        return;
      }

      const sub = interaction.options.getSubcommand();
      const dest = interaction.options.getChannel<ChannelType.GuildVoice>('destination', true);

      if (sub === 'member') {
        const user = interaction.options.getUser('user', true);
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        if (!member?.voice.channelId) {
          await interaction.reply({ content: '❌ Member is not connected to voice.', ephemeral: true });
          return;
        }

        await service.moveMember(member, dest);
        await interaction.reply({ content: `🚚 Moved <@${user.id}> to <#${dest.id}>.` });
        return;
      }

      if (sub === 'all') {
        const source = interaction.options.getChannel<ChannelType.GuildVoice>('source');
        await interaction.deferReply();
        const count = await service.moveAll(interaction.guild, dest, source ?? undefined);
        await interaction.editReply({ content: `🚚 Moved **${count}** member(s) to <#${dest.id}>.` });
      }
    },
  };

  const moveallCmd: CommandDefinition = {
    name: 'moveall',
    description: 'Mass move all connected voice members to a destination voice channel.',
    data: new SlashCommandBuilder()
      .setName('moveall')
      .setDescription('Mass move all connected voice members.')
      .addChannelOption((opt) =>
        opt
          .setName('destination')
          .setDescription('Destination voice channel')
          .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
          .setRequired(true),
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers),
    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({ content: '❌ Guild only.', ephemeral: true });
        return;
      }

      const dest = interaction.options.getChannel<ChannelType.GuildVoice>('destination', true);
      await interaction.deferReply();
      const count = await service.moveAll(interaction.guild, dest);
      await interaction.editReply({ content: `🚚 Moved **${count}** voice member(s) to <#${dest.id}>.` });
    },
  };

  return [moveCmd, moveallCmd];
}
