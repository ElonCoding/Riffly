import {
  GuildMember,
  SlashCommandBuilder,
} from 'discord.js';
import type { VoiceChannel } from 'discord.js';
import type { CommandDefinition } from '../core/types.js';
import type { VoiceRoomService } from './service.js';

export function createVoiceRoomCommands(service: VoiceRoomService): CommandDefinition[] {
  const voiceCommand: CommandDefinition = {
    name: 'voice',
    description: 'Manage your temporary voice channel.',
    data: new SlashCommandBuilder()
      .setName('voice')
      .setDescription('Manage your temporary voice channel.')
      .addSubcommand((sub) =>
        sub
          .setName('rename')
          .setDescription('Rename your voice channel.')
          .addStringOption((opt) =>
            opt.setName('name').setDescription('New channel name').setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName('limit')
          .setDescription('Set user limit for your voice channel.')
          .addIntegerOption((opt) =>
            opt
              .setName('limit')
              .setDescription('Maximum user limit (0 for unlimited, max 99)')
              .setMinValue(0)
              .setMaxValue(99)
              .setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub.setName('lock').setDescription('Lock your voice room preventing new connections.'),
      )
      .addSubcommand((sub) =>
        sub.setName('unlock').setDescription('Unlock your voice room.'),
      )
      .addSubcommand((sub) =>
        sub
          .setName('permit')
          .setDescription('Permit a user to join your locked room.')
          .addUserOption((opt) =>
            opt.setName('user').setDescription('User to permit').setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName('reject')
          .setDescription('Kick and block a user from your voice room.')
          .addUserOption((opt) =>
            opt.setName('user').setDescription('User to reject').setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName('transfer')
          .setDescription('Transfer room ownership to another member.')
          .addUserOption((opt) =>
            opt.setName('user').setDescription('New owner').setRequired(true),
          ),
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

      const voiceChannelId = member.voice.channelId;
      if (!voiceChannelId) {
        await interaction.editReply({
          content: 'You must be connected to your temporary voice room to use this command.',
        });
        return;
      }

      const voiceChannel = guild.channels.cache.get(voiceChannelId) as VoiceChannel | undefined;
      if (!voiceChannel) {
        await interaction.editReply({ content: 'Voice channel was not found.' });
        return;
      }

      const subcommand = interaction.options.getSubcommand();

      try {
        if (subcommand === 'rename') {
          const newName = interaction.options.getString('name', true);
          await service.rename(voiceChannel, member, newName);
          await interaction.editReply({ content: `✅ Renamed voice room to **${newName}**.` });
          return;
        }

        if (subcommand === 'limit') {
          const limit = interaction.options.getInteger('limit', true);
          await service.setLimit(voiceChannel, member, limit);
          await interaction.editReply({
            content: `✅ Voice room user limit updated to **${limit === 0 ? 'Unlimited' : limit}**.`,
          });
          return;
        }

        if (subcommand === 'lock') {
          await service.lock(voiceChannel, member);
          await interaction.editReply({ content: '🔒 Voice room locked.' });
          return;
        }

        if (subcommand === 'unlock') {
          await service.unlock(voiceChannel, member);
          await interaction.editReply({ content: '🔓 Voice room unlocked.' });
          return;
        }

        if (subcommand === 'permit') {
          const targetUser = interaction.options.getUser('user', true);
          const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
          if (!targetMember) {
            await interaction.editReply({ content: 'User is not in the server.' });
            return;
          }
          await service.permit(voiceChannel, member, targetMember);
          await interaction.editReply({ content: `✅ Permitted <@${targetUser.id}> to join.` });
          return;
        }

        if (subcommand === 'reject') {
          const targetUser = interaction.options.getUser('user', true);
          const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
          if (!targetMember) {
            await interaction.editReply({ content: 'User is not in the server.' });
            return;
          }
          await service.reject(voiceChannel, member, targetMember);
          await interaction.editReply({ content: `🚫 Rejected <@${targetUser.id}> from your room.` });
          return;
        }

        if (subcommand === 'transfer') {
          const targetUser = interaction.options.getUser('user', true);
          const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
          if (!targetMember) {
            await interaction.editReply({ content: 'User is not in the server.' });
            return;
          }
          await service.transferOwnership(voiceChannel, member, targetMember);
          await interaction.editReply({
            content: `👑 Transferred room ownership to <@${targetUser.id}>.`,
          });
          return;
        }
      } catch (err: unknown) {
        await interaction.editReply({
          content: `Error: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    },
  };

  return [voiceCommand];
}

