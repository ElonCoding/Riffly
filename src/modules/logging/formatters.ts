import { EmbedBuilder } from 'discord.js';
import type {
  GuildMember,
  Message,
  PartialGuildMember,
  PartialMessage,
  VoiceState,
} from 'discord.js';

export function formatMessageDeleteEmbed(message: Message | PartialMessage): EmbedBuilder | null {
  if (!message.guild || message.author?.bot) {
    return null;
  }

  return new EmbedBuilder()
    .setTitle('🗑️ Message Deleted')
    .setColor(0xef4444)
    .addFields(
      {
        name: 'Author',
        value: message.author ? `<@${message.author.id}> (${message.author.id})` : 'Unknown',
        inline: true,
      },
      { name: 'Channel', value: `<#${message.channelId}>`, inline: true },
      {
        name: 'Content',
        value: message.content ? message.content.slice(0, 1024) : '*No text content / embed only*',
        inline: false,
      },
    )
    .setTimestamp();
}

export function formatMessageUpdateEmbed(
  oldMessage: Message | PartialMessage,
  newMessage: Message | PartialMessage,
): EmbedBuilder | null {
  if (!newMessage.guild || newMessage.author?.bot) {
    return null;
  }

  if (oldMessage.content === newMessage.content) {
    return null; // Embed preview or pin update
  }

  return new EmbedBuilder()
    .setTitle('✏️ Message Edited')
    .setColor(0x3b82f6)
    .addFields(
      {
        name: 'Author',
        value: newMessage.author ? `<@${newMessage.author.id}>` : 'Unknown',
        inline: true,
      },
      { name: 'Channel', value: `<#${newMessage.channelId}>`, inline: true },
      {
        name: 'Before',
        value: oldMessage.content ? oldMessage.content.slice(0, 1024) : '*Unknown*',
        inline: false,
      },
      {
        name: 'After',
        value: newMessage.content ? newMessage.content.slice(0, 1024) : '*Empty*',
        inline: false,
      },
    )
    .setTimestamp();
}

export function formatMemberJoinEmbed(member: GuildMember): EmbedBuilder {
  const accountAgeDays = Math.floor(
    (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24),
  );

  const embed = new EmbedBuilder()
    .setTitle('📥 Member Joined')
    .setColor(0x22c55e)
    .addFields(
      { name: 'User', value: `<@${member.id}> (${member.user.tag})`, inline: true },
      { name: 'Account Age', value: `${accountAgeDays} days ago`, inline: true },
      { name: 'Member Count', value: `${member.guild.memberCount}`, inline: true },
    )
    .setTimestamp();

  const avatar = member.user?.displayAvatarURL?.();
  if (avatar) {
    embed.setThumbnail(avatar);
  }

  return embed;
}

export function formatMemberLeaveEmbed(member: GuildMember | PartialGuildMember): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle('📤 Member Left')
    .setColor(0x6b7280)
    .addFields(
      { name: 'User', value: `${member.user?.tag ?? 'Unknown'} (<@${member.id}>)`, inline: true },
      { name: 'Remaining Members', value: `${member.guild.memberCount}`, inline: true },
    )
    .setTimestamp();

  const avatar = member.user?.displayAvatarURL?.();
  if (avatar) {
    embed.setThumbnail(avatar);
  }

  return embed;
}

export function formatVoiceStateEmbed(
  oldState: VoiceState,
  newState: VoiceState,
): EmbedBuilder | null {
  const member = newState.member ?? oldState.member;
  if (!member || member.user.bot) {
    return null;
  }

  // User joined voice channel
  if (!oldState.channelId && newState.channelId) {
    return new EmbedBuilder()
      .setTitle('🔊 Voice Joined')
      .setColor(0x10b981)
      .setDescription(`<@${member.id}> joined voice channel <#${newState.channelId}>`)
      .setTimestamp();
  }

  // User left voice channel
  if (oldState.channelId && !newState.channelId) {
    return new EmbedBuilder()
      .setTitle('🔇 Voice Left')
      .setColor(0xf97316)
      .setDescription(`<@${member.id}> left voice channel <#${oldState.channelId}>`)
      .setTimestamp();
  }

  // User moved voice channel
  if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
    return new EmbedBuilder()
      .setTitle('🔄 Voice Switched')
      .setColor(0x8b5cf6)
      .setDescription(
        `<@${member.id}> moved from <#${oldState.channelId}> to <#${newState.channelId}>`,
      )
      .setTimestamp();
  }

  return null;
}

export function formatMemberUpdateEmbed(
  oldMember: GuildMember | PartialGuildMember,
  newMember: GuildMember,
): EmbedBuilder | null {
  if (newMember.user.bot) return null;

  // Nickname change
  if (oldMember.nickname !== newMember.nickname) {
    return new EmbedBuilder()
      .setTitle('✏️ Nickname Changed')
      .setColor(0x3b82f6)
      .addFields(
        { name: 'Member', value: `<@${newMember.id}> (${newMember.user.tag})`, inline: true },
        { name: 'Before', value: oldMember.nickname ?? '*None*', inline: true },
        { name: 'After', value: newMember.nickname ?? '*None*', inline: true },
      )
      .setTimestamp();
  }

  // Role changes
  const oldRoles = new Set(oldMember.roles?.cache?.keys() ?? []);
  const newRoles = new Set(newMember.roles?.cache?.keys() ?? []);

  const added = [...newRoles].filter((r) => !oldRoles.has(r) && r !== newMember.guild.id);
  const removed = [...oldRoles].filter((r) => !newRoles.has(r) && r !== newMember.guild.id);

  if (added.length > 0 || removed.length > 0) {
    const embed = new EmbedBuilder()
      .setTitle('🛡️ Member Roles Updated')
      .setColor(0x6366f1)
      .addFields({
        name: 'Member',
        value: `<@${newMember.id}> (${newMember.user.tag})`,
        inline: false,
      })
      .setTimestamp();

    if (added.length > 0) {
      embed.addFields({
        name: 'Roles Added',
        value: added.map((r) => `<@&${r}>`).join(', '),
        inline: false,
      });
    }

    if (removed.length > 0) {
      embed.addFields({
        name: 'Roles Removed',
        value: removed.map((r) => `<@&${r}>`).join(', '),
        inline: false,
      });
    }

    return embed;
  }

  return null;
}

export function formatGuildBanAddEmbed(ban: { user: { id: string; tag: string; displayAvatarURL?: () => string }; reason?: string | null }): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('🔨 Member Banned')
    .setColor(0xef4444)
    .setThumbnail(ban.user.displayAvatarURL ? ban.user.displayAvatarURL() : null)
    .addFields(
      { name: 'User', value: `${ban.user.tag} (<@${ban.user.id}>)`, inline: true },
      { name: 'Reason', value: ban.reason ?? 'No reason provided', inline: false },
    )
    .setTimestamp();
}

export function formatGuildBanRemoveEmbed(ban: { user: { id: string; tag: string; displayAvatarURL?: () => string } }): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('🔓 Member Unbanned')
    .setColor(0x22c55e)
    .setThumbnail(ban.user.displayAvatarURL ? ban.user.displayAvatarURL() : null)
    .addFields(
      { name: 'User', value: `${ban.user.tag} (<@${ban.user.id}>)`, inline: true },
    )
    .setTimestamp();
}

export function formatChannelCreateEmbed(channel: { id: string; name: string; type: number }): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('📁 Channel Created')
    .setColor(0x10b981)
    .addFields(
      { name: 'Channel', value: `<#${channel.id}> (${channel.name})`, inline: true },
      { name: 'Channel ID', value: channel.id, inline: true },
    )
    .setTimestamp();
}

export function formatChannelDeleteEmbed(channel: { id: string; name: string; type?: number }): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('🗑️ Channel Deleted')
    .setColor(0xef4444)
    .addFields(
      { name: 'Name', value: channel.name, inline: true },
      { name: 'Channel ID', value: channel.id, inline: true },
    )
    .setTimestamp();
}

export function formatRoleCreateEmbed(role: { id: string; name: string }): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('✨ Role Created')
    .setColor(0x3b82f6)
    .addFields(
      { name: 'Role', value: `<@&${role.id}> (${role.name})`, inline: true },
      { name: 'Role ID', value: role.id, inline: true },
    )
    .setTimestamp();
}

export function formatRoleDeleteEmbed(role: { id: string; name: string }): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('🗑️ Role Deleted')
    .setColor(0x6b7280)
    .addFields(
      { name: 'Role Name', value: role.name, inline: true },
      { name: 'Role ID', value: role.id, inline: true },
    )
    .setTimestamp();
}

export function formatCommandLogEmbed(interaction: {
  commandName: string;
  user: { id: string; tag: string };
  channelId: string | null;
  options?: { data?: readonly { name: string; value?: unknown }[] };
}): EmbedBuilder {
  const optionsStr =
    interaction.options?.data
      ?.map((o) => `${o.name}:${String(o.value ?? '')}`)
      .join(' ') || '';

  return new EmbedBuilder()
    .setTitle('🤖 Command Executed')
    .setColor(0x8b5cf6)
    .addFields(
      { name: 'User', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
      { name: 'Command', value: `\`/${interaction.commandName}${optionsStr ? ' ' + optionsStr : ''}\``, inline: true },
      { name: 'Channel', value: interaction.channelId ? `<#${interaction.channelId}>` : 'DM / Unknown', inline: true },
    )
    .setTimestamp();
}
