import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { CommandDefinition } from '../core/types.js';
import type { VerificationService } from './service.js';

export function createVerificationCommands(service: VerificationService): CommandDefinition[] {
  const verifyCommand: CommandDefinition = {
    name: 'verify',
    description: 'Configure and post verification panels.',
    data: new SlashCommandBuilder()
      .setName('verify')
      .setDescription('Configure and post verification panels.')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addSubcommand((sub) =>
        sub
          .setName('setup')
          .setDescription('Configure the verified role and verification channel')
          .addRoleOption((opt) => opt.setName('role').setDescription('Role granted upon verification').setRequired(true))
          .addChannelOption((opt) =>
            opt.setName('channel').setDescription('Channel where users verify').addChannelTypes(ChannelType.GuildText).setRequired(true),
          )
          .addStringOption((opt) =>
            opt
              .setName('type')
              .setDescription('Verification type')
              .addChoices(
                { name: 'One-Click Button', value: 'button' },
                { name: 'Captcha Challenge', value: 'captcha' },
              ),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName('panel')
          .setDescription('Dispatch an interactive verification panel')
          .addChannelOption((opt) =>
            opt.setName('channel').setDescription('Target text channel').addChannelTypes(ChannelType.GuildText).setRequired(true),
          )
          .addStringOption((opt) => opt.setName('title').setDescription('Panel title'))
          .addStringOption((opt) => opt.setName('description').setDescription('Panel instructions'))
          .addStringOption((opt) => opt.setName('button_label').setDescription('Custom button label')),
      )
      .addSubcommand((sub) => sub.setName('view').setDescription('View current verification configuration')),
    guildOnly: true,
    defaultMemberPermissions: PermissionFlagsBits.Administrator,
    execute: async (interaction: ChatInputCommandInteraction) => {
      await interaction.deferReply({ ephemeral: true });
      const guild = interaction.guild;
      if (!guild) {
        await interaction.editReply({ content: 'Command can only be run in a server.' });
        return;
      }

      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'setup') {
        const role = interaction.options.getRole('role', true);
        const channel = interaction.options.getChannel('channel', true);

        await service.saveSettings(guild.id, role.id, channel.id);
        await interaction.editReply(
          `✅ **Verification Configured.**\n• Role: <@&${role.id}>\n• Channel: <#${channel.id}>`,
        );
        return;
      }

      if (subcommand === 'panel') {
        const channel = interaction.options.getChannel<ChannelType.GuildText>('channel', true);
        const title = interaction.options.getString('title') ?? 'Server Verification';
        const description = interaction.options.getString('description') ?? 'Click the button below to verify your account.';
        const buttonLabel = interaction.options.getString('button_label') ?? 'Verify';

        await service.sendVerificationPanel(channel, title, description, buttonLabel);
        await interaction.editReply(`✅ Verification panel dispatched to <#${channel.id}>.`);
        return;
      }

      if (subcommand === 'view') {
        const settings = await service.getSettings(guild.id);
        if (!settings) {
          await interaction.editReply('Verification is not yet configured for this server. Use `/verify setup`.');
          return;
        }

        const embed = new EmbedBuilder()
          .setTitle('🛡️ Riffly Verification Settings')
          .setColor(0x10b981)
          .addFields(
            { name: 'Verified Role', value: `<@&${settings.roleId}>`, inline: true },
            { name: 'Verification Channel', value: `<#${settings.channelId}>`, inline: true },
            { name: 'Button Label', value: settings.buttonLabel, inline: true },
          )
          .setFooter({ text: 'Riffly Security System' });

        await interaction.editReply({ embeds: [embed] });
      }
    },
  };

  return [verifyCommand];
}
