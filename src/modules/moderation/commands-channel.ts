import {
  ChannelType,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type TextChannel,
  type Role,
} from 'discord.js';
import type { CommandDefinition } from '../core/types.js';
import type { ModerationService } from './service.js';

export function createChannelModerationCommands(service: ModerationService): CommandDefinition[] {
  const slowmodeCmd: CommandDefinition = {
    name: 'slowmode',
    description: 'Set channel message rate limit.',
    data: new SlashCommandBuilder()
      .setName('slowmode')
      .setDescription('Set channel message rate limit in seconds (0 to disable).')
      .addIntegerOption((opt) =>
        opt
          .setName('seconds')
          .setDescription('Cooldown duration in seconds (0 - 21600)')
          .setMinValue(0)
          .setMaxValue(21600)
          .setRequired(true),
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.inGuild() || !interaction.channel || !('setRateLimitPerUser' in interaction.channel)) {
        await interaction.reply({ content: '❌ Text channel only.', ephemeral: true });
        return;
      }
      const seconds = interaction.options.getInteger('seconds', true);
      const textChan = interaction.channel as TextChannel;
      await textChan.setRateLimitPerUser(seconds, `Slowmode by ${interaction.user.tag}`);
      await interaction.reply({
        content: seconds === 0 ? '🚀 Slowmode has been disabled.' : `⏱️ Slowmode set to **${seconds}s**.`,
      });
    },
  };

  const lockCmd: CommandDefinition = {
    name: 'lock',
    description: 'Lock a text or voice channel.',
    data: new SlashCommandBuilder()
      .setName('lock')
      .setDescription('Lock a channel preventing members from chatting or connecting.')
      .addChannelOption((opt) => opt.setName('channel').setDescription('Target channel (defaults to current)').setRequired(false))
      .addRoleOption((opt) => opt.setName('role').setDescription('Role to lock (defaults to @everyone)').setRequired(false))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({ content: '❌ Guild only.', ephemeral: true });
        return;
      }
      const chan = (interaction.options.getChannel('channel') ?? interaction.channel) as TextChannel;
      const role = (interaction.options.getRole('role') ?? interaction.guild.roles.everyone) as Role;

      await chan.permissionOverwrites.edit(role.id, {
        [PermissionFlagsBits.SendMessages.toString()]: false,
      });

      await interaction.reply({ content: `🔒 Locked <#${chan.id}> for **${role.name}**.` });
    },
  };

  const unlockCmd: CommandDefinition = {
    name: 'unlock',
    description: 'Unlock a text channel.',
    data: new SlashCommandBuilder()
      .setName('unlock')
      .setDescription('Unlock a channel permitting members to send messages.')
      .addChannelOption((opt) => opt.setName('channel').setDescription('Target channel (defaults to current)').setRequired(false))
      .addRoleOption((opt) => opt.setName('role').setDescription('Role to unlock (defaults to @everyone)').setRequired(false))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({ content: '❌ Guild only.', ephemeral: true });
        return;
      }
      const chan = (interaction.options.getChannel('channel') ?? interaction.channel) as TextChannel;
      const role = (interaction.options.getRole('role') ?? interaction.guild.roles.everyone) as Role;

      await chan.permissionOverwrites.edit(role.id, {
        [PermissionFlagsBits.SendMessages.toString()]: true,
      });

      await interaction.reply({ content: `🔓 Unlocked <#${chan.id}> for **${role.name}**.` });
    },
  };

  const lockallCmd: CommandDefinition = {
    name: 'lockall',
    description: 'Lock all text channels in the server.',
    data: new SlashCommandBuilder()
      .setName('lockall')
      .setDescription('Engage server-wide text channel lockdown.')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({ content: '❌ Guild only.', ephemeral: true });
        return;
      }
      await interaction.deferReply();
      const count = await service.lockall(interaction.guild, true, interaction.user.tag);
      await interaction.editReply({ content: `🚨 Server lockdown active! Locked **${count}** text channels.` });
    },
  };

  const unlockallCmd: CommandDefinition = {
    name: 'unlockall',
    description: 'Unlock all text channels in the server.',
    data: new SlashCommandBuilder()
      .setName('unlockall')
      .setDescription('Release server-wide text channel lockdown.')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({ content: '❌ Guild only.', ephemeral: true });
        return;
      }
      await interaction.deferReply();
      const count = await service.lockall(interaction.guild, false, interaction.user.tag);
      await interaction.editReply({ content: `✅ Server lockdown released! Unlocked **${count}** text channels.` });
    },
  };

  const hideCmd: CommandDefinition = {
    name: 'hide',
    description: 'Hide a text channel.',
    data: new SlashCommandBuilder()
      .setName('hide')
      .setDescription('Hide channel from role or @everyone.')
      .addChannelOption((opt) => opt.setName('channel').setDescription('Target channel').setRequired(false))
      .addRoleOption((opt) => opt.setName('role').setDescription('Target role').setRequired(false))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({ content: '❌ Guild only.', ephemeral: true });
        return;
      }
      const chan = (interaction.options.getChannel('channel') ?? interaction.channel) as TextChannel;
      const role = (interaction.options.getRole('role') ?? interaction.guild.roles.everyone) as Role;
      await service.setChannelVisibility(chan, role, false, interaction.user.tag);
      await interaction.reply({ content: `👁️‍🗨️ Hidden <#${chan.id}> for **${role.name}**.` });
    },
  };

  const unhideCmd: CommandDefinition = {
    name: 'unhide',
    description: 'Unhide a text channel.',
    data: new SlashCommandBuilder()
      .setName('unhide')
      .setDescription('Make channel visible to role or @everyone.')
      .addChannelOption((opt) => opt.setName('channel').setDescription('Target channel').setRequired(false))
      .addRoleOption((opt) => opt.setName('role').setDescription('Target role').setRequired(false))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({ content: '❌ Guild only.', ephemeral: true });
        return;
      }
      const chan = (interaction.options.getChannel('channel') ?? interaction.channel) as TextChannel;
      const role = (interaction.options.getRole('role') ?? interaction.guild.roles.everyone) as Role;
      await service.setChannelVisibility(chan, role, true, interaction.user.tag);
      await interaction.reply({ content: `👁️ Unhidden <#${chan.id}> for **${role.name}**.` });
    },
  };

  const vclockCmd: CommandDefinition = {
    name: 'vclock',
    description: 'Lock a voice channel.',
    data: new SlashCommandBuilder()
      .setName('vclock')
      .setDescription('Lock a voice channel preventing new connections.')
      .addChannelOption((opt) =>
        opt
          .setName('channel')
          .setDescription('Target voice channel')
          .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
          .setRequired(true),
      )
      .addRoleOption((opt) => opt.setName('role').setDescription('Target role').setRequired(false))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({ content: '❌ Guild only.', ephemeral: true });
        return;
      }
      const chan = interaction.options.getChannel<ChannelType.GuildVoice>('channel', true);
      const role = (interaction.options.getRole('role') ?? interaction.guild.roles.everyone) as Role;
      await service.setVoiceChannelLock(chan, role, true, interaction.user.tag);
      await interaction.reply({ content: `🔒 Locked voice channel <#${chan.id}> for **${role.name}**.` });
    },
  };

  const vcunlockCmd: CommandDefinition = {
    name: 'vcunlock',
    description: 'Unlock a voice channel.',
    data: new SlashCommandBuilder()
      .setName('vcunlock')
      .setDescription('Unlock a voice channel allowing connections.')
      .addChannelOption((opt) =>
        opt
          .setName('channel')
          .setDescription('Target voice channel')
          .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
          .setRequired(true),
      )
      .addRoleOption((opt) => opt.setName('role').setDescription('Target role').setRequired(false))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({ content: '❌ Guild only.', ephemeral: true });
        return;
      }
      const chan = interaction.options.getChannel<ChannelType.GuildVoice>('channel', true);
      const role = (interaction.options.getRole('role') ?? interaction.guild.roles.everyone) as Role;
      await service.setVoiceChannelLock(chan, role, false, interaction.user.tag);
      await interaction.reply({ content: `🔓 Unlocked voice channel <#${chan.id}> for **${role.name}**.` });
    },
  };

  const vchideCmd: CommandDefinition = {
    name: 'vchide',
    description: 'Hide a voice channel.',
    data: new SlashCommandBuilder()
      .setName('vchide')
      .setDescription('Hide a voice channel from a role or @everyone.')
      .addChannelOption((opt) =>
        opt
          .setName('channel')
          .setDescription('Target voice channel')
          .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
          .setRequired(true),
      )
      .addRoleOption((opt) => opt.setName('role').setDescription('Target role').setRequired(false))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({ content: '❌ Guild only.', ephemeral: true });
        return;
      }
      const chan = interaction.options.getChannel<ChannelType.GuildVoice>('channel', true);
      const role = (interaction.options.getRole('role') ?? interaction.guild.roles.everyone) as Role;
      await service.setChannelVisibility(chan, role, false, interaction.user.tag);
      await interaction.reply({ content: `👁️‍🗨️ Hidden voice channel <#${chan.id}> for **${role.name}**.` });
    },
  };

  const vcunhideCmd: CommandDefinition = {
    name: 'vcunhide',
    description: 'Unhide a voice channel.',
    data: new SlashCommandBuilder()
      .setName('vcunhide')
      .setDescription('Make a voice channel visible to a role or @everyone.')
      .addChannelOption((opt) =>
        opt
          .setName('channel')
          .setDescription('Target voice channel')
          .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
          .setRequired(true),
      )
      .addRoleOption((opt) => opt.setName('role').setDescription('Target role').setRequired(false))
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({ content: '❌ Guild only.', ephemeral: true });
        return;
      }
      const chan = interaction.options.getChannel<ChannelType.GuildVoice>('channel', true);
      const role = (interaction.options.getRole('role') ?? interaction.guild.roles.everyone) as Role;
      await service.setChannelVisibility(chan, role, true, interaction.user.tag);
      await interaction.reply({ content: `👁️ Unhidden voice channel <#${chan.id}> for **${role.name}**.` });
    },
  };

  return [
    slowmodeCmd,
    lockCmd,
    unlockCmd,
    lockallCmd,
    unlockallCmd,
    hideCmd,
    unhideCmd,
    vclockCmd,
    vcunlockCmd,
    vchideCmd,
    vcunhideCmd,
  ];
}
