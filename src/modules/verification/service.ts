import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from 'discord.js';
import type {
  GuildMember,
  PartialGuildMember,
  TextChannel,
} from 'discord.js';
import { getPrismaClient } from '../../database/client.js';

export interface VerificationConfig {
  guildId: string;
  roleId: string;
  channelId: string;
  description: string | null;
  buttonLabel: string;
}

export class VerificationService {
  private readonly client = getPrismaClient();

  public async getSettings(guildId: string): Promise<VerificationConfig | null> {
    const record = await this.client.verificationSetting.findUnique({
      where: { guildId },
    });
    return record;
  }

  public async saveSettings(
    guildId: string,
    roleId: string,
    channelId: string,
    buttonLabel = 'Verify',
    description?: string,
  ): Promise<VerificationConfig> {
    await this.client.guildSettings.upsert({
      where: { guildId },
      update: {},
      create: { guildId },
    });

    const updated = await this.client.verificationSetting.upsert({
      where: { guildId },
      update: {
        roleId,
        channelId,
        buttonLabel,
        description: description ?? null,
      },
      create: {
        guildId,
        roleId,
        channelId,
        buttonLabel,
        description: description ?? null,
      },
    });
    return updated;
  }

  /**
   * Posts an interactive verification embed with a single click verification button.
   */
  public async sendVerificationPanel(
    channel: TextChannel,
    title = 'Server Verification',
    description = 'Click the button below to verify your account and unlock access to the server.',
    buttonLabel = 'Verify',
  ): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle(`🛡️ ${title}`)
      .setColor(0x10b981)
      .setDescription(description)
      .setFooter({ text: 'Riffly Security & Verification' })
      .setTimestamp();

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('riffly_verify_btn')
        .setLabel(buttonLabel)
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success),
    );

    await channel.send({ embeds: [embed], components: [row] });
  }

  /**
   * Processes a verification button interaction by granting the verified role.
   */
  public async handleVerificationClick(
    member: GuildMember,
    verifiedRoleId: string,
  ): Promise<{ success: boolean; message: string }> {
    if (!verifiedRoleId) {
      return { success: false, message: 'Verified role is not configured on this server.' };
    }

    const role = member.guild.roles.cache.get(verifiedRoleId);
    if (!role) {
      return { success: false, message: 'Configured verified role was not found.' };
    }

    if (member.roles.cache.has(verifiedRoleId)) {
      return { success: true, message: 'You are already verified!' };
    }

    await member.roles.add(role, 'User passed server verification.');
    return { success: true, message: `✅ Verification complete! Granted role **${role.name}**.` };
  }

  /**
   * Automatically assigns a newcomer role and dispatches a welcome embed.
   */
  public async handleMemberJoin(
    member: GuildMember,
    options: {
      autoRoleId?: string;
      welcomeChannelId?: string;
      welcomeMessage?: string;
    },
  ): Promise<void> {
    // Auto-role assignment
    if (options.autoRoleId) {
      const role = member.guild.roles.cache.get(options.autoRoleId);
      if (role) {
        await member.roles.add(role, 'Automatic newcomer role assignment.').catch(() => null);
      }
    }

    // Welcome embed
    if (options.welcomeChannelId) {
      const channel = await member.guild.channels.fetch(options.welcomeChannelId).catch(() => null);
      if (channel && 'send' in channel && typeof (channel as TextChannel).send === 'function') {
        const text = options.welcomeMessage
          ? options.welcomeMessage
              .replace('{user}', `<@${member.id}>`)
              .replace('{server}', member.guild.name)
              .replace('{count}', String(member.guild.memberCount))
          : `Welcome <@${member.id}> to **${member.guild.name}**! You are member #${member.guild.memberCount}.`;

        const embed = new EmbedBuilder()
          .setTitle('👋 Welcome to the Server!')
          .setColor(0x6366f1)
          .setDescription(text)
          .setThumbnail(member.user.displayAvatarURL())
          .setTimestamp();

        await (channel as TextChannel).send({ embeds: [embed] }).catch(() => null);
      }
    }
  }

  /**
   * Dispatches a goodbye embed when a member departs.
   */
  public async handleMemberLeave(
    member: GuildMember | PartialGuildMember,
    goodbyeChannelId?: string,
    goodbyeMessage?: string,
  ): Promise<void> {
    if (!goodbyeChannelId) return;

    const guild = member.guild;
    const channel = await guild.channels.fetch(goodbyeChannelId).catch(() => null);
    if (channel && 'send' in channel && typeof (channel as TextChannel).send === 'function') {
      const text = goodbyeMessage
        ? goodbyeMessage
            .replace('{user}', member.user?.tag ?? `<@${member.id}>`)
            .replace('{server}', guild.name)
        : `**${member.user?.tag ?? member.id}** has left **${guild.name}**. Farewell!`;

      const embed = new EmbedBuilder()
        .setTitle('👋 Farewell')
        .setColor(0x9ca3af)
        .setDescription(text)
        .setTimestamp();

      await (channel as TextChannel).send({ embeds: [embed] }).catch(() => null);
    }
  }
}

