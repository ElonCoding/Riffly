import { EmbedBuilder } from 'discord.js';
import type {
  GuildMember,
  Message,
  PartialGuildMember,
  PartialMessage,
  VoiceState,
} from 'discord.js';

export function formatMessageDeleteEmbed(
  message: Message | PartialMessage,
): EmbedBuilder | null {
  if (!message.guild || message.author?.bot) {
    return null;
  }

  return new EmbedBuilder()
    .setTitle('🗑️ Message Deleted')
    .setColor(0xef4444)
    .addFields(
      { name: 'Author', value: message.author ? `<@${message.author.id}> (${message.author.id})` : 'Unknown', inline: true },
      { name: 'Channel', value: `<#${message.channelId}>`, inline: true },
      { name: 'Content', value: message.content ? message.content.slice(0, 1024) : '*No text content / embed only*', inline: false },
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
      { name: 'Author', value: newMessage.author ? `<@${newMessage.author.id}>` : 'Unknown', inline: true },
      { name: 'Channel', value: `<#${newMessage.channelId}>`, inline: true },
      { name: 'Before', value: oldMessage.content ? oldMessage.content.slice(0, 1024) : '*Unknown*', inline: false },
      { name: 'After', value: newMessage.content ? newMessage.content.slice(0, 1024) : '*Empty*', inline: false },
    )
    .setTimestamp();
}

export function formatMemberJoinEmbed(member: GuildMember): EmbedBuilder {
  const accountAgeDays = Math.floor(
    (Date.now() - member.user.createdTimestamp) / (1000 * 60 * 60 * 24),
  );

  return new EmbedBuilder()
    .setTitle('📥 Member Joined')
    .setColor(0x22c55e)
    .setThumbnail(member.user.displayAvatarURL())
    .addFields(
      { name: 'User', value: `<@${member.id}> (${member.user.tag})`, inline: true },
      { name: 'Account Age', value: `${accountAgeDays} days ago`, inline: true },
      { name: 'Member Count', value: `${member.guild.memberCount}`, inline: true },
    )
    .setTimestamp();
}

export function formatMemberLeaveEmbed(
  member: GuildMember | PartialGuildMember,
): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('📤 Member Left')
    .setColor(0x6b7280)
    .setThumbnail(member.user.displayAvatarURL())
    .addFields(
      { name: 'User', value: `${member.user.tag} (<@${member.id}>)`, inline: true },
      { name: 'Remaining Members', value: `${member.guild.memberCount}`, inline: true },
    )
    .setTimestamp();
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
