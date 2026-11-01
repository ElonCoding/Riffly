import {
  EmbedBuilder,
  GuildMember,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type VoiceChannel,
} from 'discord.js';
import type { CommandDefinition } from '../core/types.js';
import type { VoiceRoomService } from './service.js';

export function createVoiceRoomCommands(service: VoiceRoomService): CommandDefinition[] {
  const buildVcSubcommands = (builder: SlashCommandBuilder) => {
    return builder
      .addSubcommand((sub) =>
        sub
          .setName('limit')
          .setDescription('Set user limit (0 = unlimited, max 99).')
          .addIntegerOption((opt) =>
            opt
              .setName('number')
              .setDescription('Maximum participants')
              .setMinValue(0)
              .setMaxValue(99)
              .setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName('rename')
          .setDescription('Rename your voice channel.')
          .addStringOption((opt) =>
            opt.setName('name').setDescription('New name').setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub.setName('lock').setDescription('Lock voice channel for @everyone.'),
      )
      .addSubcommand((sub) =>
        sub.setName('unlock').setDescription('Unlock voice channel for @everyone.'),
      )
      .addSubcommand((sub) =>
        sub.setName('hide').setDescription('Hide voice channel from @everyone.'),
      )
      .addSubcommand((sub) =>
        sub.setName('unhide').setDescription('Make voice channel visible to @everyone.'),
      )
      .addSubcommand((sub) =>
        sub
          .setName('permit')
          .setDescription('Allow a specific user into your locked VC.')
          .addUserOption((opt) =>
            opt.setName('user').setDescription('Target user').setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName('ban')
          .setDescription('Remove and block a user from your VC.')
          .addUserOption((opt) =>
            opt.setName('user').setDescription('Target user').setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName('transfer')
          .setDescription('Transfer VC ownership to another member.')
          .addUserOption((opt) =>
            opt.setName('user').setDescription('New owner').setRequired(true),
          ),
      );
  };

  const executeVcLogic = async (interaction: ChatInputCommandInteraction) => {
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
        content: '🔇 You must be connected to your temporary voice room to use this command.',
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
        const limit = interaction.options.getInteger('number', true);
        await service.setLimit(voiceChannel, member, limit);
        await interaction.editReply({
          content:
            limit === 0 ? '✅ Removed user limit.' : `✅ Set room limit to **${limit}** members.`,
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

      if (subcommand === 'hide') {
        await service.hide(voiceChannel, member);
        await interaction.editReply({ content: '👁️‍🗨️ Voice room hidden from @everyone.' });
        return;
      }

      if (subcommand === 'unhide') {
        await service.unhide(voiceChannel, member);
        await interaction.editReply({ content: '👁️ Voice room unhidden.' });
        return;
      }

      if (subcommand === 'permit') {
        const targetUser = interaction.options.getUser('user', true);
        const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
        if (!targetMember) {
          await interaction.editReply({ content: 'User is not in this server.' });
          return;
        }
        await service.permit(voiceChannel, member, targetMember);
        await interaction.editReply({ content: `✅ Permitted <@${targetUser.id}> to join.` });
        return;
      }

      if (subcommand === 'ban') {
        const targetUser = interaction.options.getUser('user', true);
        const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
        if (!targetMember) {
          await interaction.editReply({ content: 'User is not in this server.' });
          return;
        }
        await service.reject(voiceChannel, member, targetMember);
        await interaction.editReply({
          content: `🚫 Blocked <@${targetUser.id}> from this voice room.`,
        });
        return;
      }

      if (subcommand === 'transfer') {
        const targetUser = interaction.options.getUser('user', true);
        const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
        if (!targetMember) {
          await interaction.editReply({ content: 'User is not in this server.' });
          return;
        }
        await service.transferOwnership(voiceChannel, member, targetMember);
        await interaction.editReply({
          content: `👑 Transferred room ownership to <@${targetUser.id}>.`,
        });
      }
    } catch (err: unknown) {
      await interaction.editReply({
        content: `❌ ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  };

  const vcCommand: CommandDefinition = {
    name: 'vc',
    description: 'Manage your self-managed VoiceMaster voice channel.',
    data: buildVcSubcommands(
      new SlashCommandBuilder()
        .setName('vc')
        .setDescription('Manage your VoiceMaster voice channel.'),
    ),
    guildOnly: true,
    execute: executeVcLogic,
  };

  const voicemasterCommand: CommandDefinition = {
    name: 'voicemaster',
    description: 'VoiceMaster dynamic voice system management.',
    data: new SlashCommandBuilder()
      .setName('voicemaster')
      .setDescription('VoiceMaster automated channel setup and controls.')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
      .addSubcommand((sub) =>
        sub
          .setName('setup')
          .setDescription('Configure VoiceMaster join-to-create category & hub.')
          .addStringOption((opt) =>
            opt
              .setName('type')
              .setDescription('Room type preset')
              .addChoices(
                { name: 'Normal (Unlimited)', value: 'normal' },
                { name: 'Duo (2 Members)', value: 'duo' },
                { name: 'Trio (3 Members)', value: 'trio' },
                { name: 'Quad (4 Members)', value: 'quad' },
              )
              .setRequired(false),
          ),
      )
      .addSubcommand((sub) =>
        sub.setName('info').setDescription('View VoiceMaster channel status.'),
      ),
    guildOnly: true,
    execute: async (interaction) => {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({ content: '❌ Guild only.', ephemeral: true });
        return;
      }

      const sub = interaction.options.getSubcommand();
      if (sub === 'setup') {
        await interaction.deferReply();
        const type = (interaction.options.getString('type') ?? 'normal') as
          'normal' | 'duo' | 'trio' | 'quad';
        const res = await service.setupVoiceMaster(interaction.guild, type);

        const embed = new EmbedBuilder()
          .setTitle('🎙️ VoiceMaster Configured')
          .setColor(0x57f287)
          .setDescription(
            `Successfully deployed VoiceMaster infrastructure!\n\n` +
              `• **Category ID:** \`${res.categoryId}\`\n` +
              `• **Hub Channel:** <#${res.hubChannelId}>\n` +
              `• **Preset:** \`${type.toUpperCase()}\``,
          )
          .setFooter({ text: 'Riffly • VoiceMaster System' });

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (sub === 'info') {
        const member = interaction.member instanceof GuildMember ? interaction.member : null;
        const voiceId = member?.voice.channelId;
        const room = voiceId ? service.getRoom(voiceId) : undefined;

        const embed = new EmbedBuilder()
          .setTitle('🎙️ VoiceMaster Room Status')
          .setColor(0x5865f2)
          .setDescription(
            room
              ? `• **Owner:** <@${room.ownerId}>\n• **Channel:** <#${room.channelId}>\n• **Created:** <t:${Math.floor(room.createdAt.getTime() / 1000)}:R>`
              : 'You are not currently in a VoiceMaster temporary channel.',
          );

        await interaction.reply({ embeds: [embed], ephemeral: true });
      }
    },
  };

  const setupVcCommand: CommandDefinition = {
    name: 'setup-vc',
    description: 'Configure Join-to-Create voice system (Normal/Duo/Trio/Quad types).',
    data: new SlashCommandBuilder()
      .setName('setup-vc')
      .setDescription('Configure Join-to-Create voice system.')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption((opt) =>
        opt
          .setName('type')
          .setDescription('Room type preset')
          .addChoices(
            { name: 'Normal (Unlimited)', value: 'normal' },
            { name: 'Duo (2 Members)', value: 'duo' },
            { name: 'Trio (3 Members)', value: 'trio' },
            { name: 'Quad (4 Members)', value: 'quad' },
          )
          .setRequired(false),
      ),
    guildOnly: true,
    execute: async (interaction) => {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({ content: '❌ Guild only.', ephemeral: true });
        return;
      }
      await interaction.deferReply();
      const type = (interaction.options.getString('type') ?? 'normal') as
        'normal' | 'duo' | 'trio' | 'quad';
      const res = await service.setupVoiceMaster(interaction.guild, type);

      const embed = new EmbedBuilder()
        .setTitle('🎙️ VoiceMaster Configured')
        .setColor(0x57f287)
        .setDescription(
          `Successfully deployed VoiceMaster infrastructure!\n\n` +
            `• **Category ID:** \`${res.categoryId}\`\n` +
            `• **Hub Channel:** <#${res.hubChannelId}>\n` +
            `• **Preset:** \`${type.toUpperCase()}\``,
        )
        .setFooter({ text: 'Riffly • VoiceMaster System' });

      await interaction.editReply({ embeds: [embed] });
    },
  };

  return [vcCommand, voicemasterCommand, setupVcCommand];
}
