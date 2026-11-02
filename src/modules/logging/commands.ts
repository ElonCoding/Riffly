/**
 * Logging setup and channel routing commands.
 */

import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Guild,
} from 'discord.js';
import type { CommandDefinition } from '../core/types.js';
import type { ILoggingStore } from './service.js';

export const DEDICATED_LOG_CHANNELS = [
  { key: 'message', name: '💬・message-logs', topic: 'Message edits, deletions, and purges' },
  { key: 'voice', name: '🔊・voice-logs', topic: 'Voice channel joins, leaves, and streams' },
  { key: 'member', name: '👤・member-logs', topic: 'Member joins, leaves, roles, and nicknames' },
  { key: 'mod', name: '🛡️・mod-logs', topic: 'Bans, kicks, warns, timeouts, and jails' },
  { key: 'server', name: '⚙️・server-logs', topic: 'Channels, roles, invites, and guild updates' },
  {
    key: 'bot',
    name: '🤖・bot-logs',
    topic: 'Slash commands, bot admin actions, and system events',
  },
] as const;

export type LogTypeKey = (typeof DEDICATED_LOG_CHANNELS)[number]['key'];

export class MemoryLoggingStore implements ILoggingStore {
  private readonly store = new Map<string, Map<string, string>>();

  public setLogChannel(guildId: string, logType: string, channelId: string): Promise<void> {
    const guildMap = this.store.get(guildId) ?? new Map<string, string>();
    guildMap.set(logType, channelId);
    this.store.set(guildId, guildMap);
    return Promise.resolve();
  }

  public disableLog(guildId: string, logType: string): Promise<void> {
    const guildMap = this.store.get(guildId);
    if (guildMap) {
      if (logType === 'all') {
        guildMap.clear();
      } else {
        guildMap.delete(logType);
      }
    }
    return Promise.resolve();
  }

  public getLogChannels(guildId: string): Promise<Record<string, string>> {
    const guildMap = this.store.get(guildId);
    if (!guildMap) return Promise.resolve({});
    const res: Record<string, string> = {};
    for (const [k, v] of guildMap.entries()) {
      res[k] = v;
    }
    return Promise.resolve(res);
  }
}

export async function executeOneClickLogSetup(
  guild: Guild,
  store: ILoggingStore,
): Promise<{ categoryName: string; channelsCreated: string[] }> {
  const botMember = guild.members.me;

  // Create private category
  const category = await guild.channels.create({
    name: 'RIFFLY LOGS',
    type: ChannelType.GuildCategory,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      ...(botMember
        ? [
            {
              id: botMember.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.EmbedLinks,
                PermissionFlagsBits.AttachFiles,
              ],
            },
          ]
        : []),
    ],
  });

  const channelsCreated: string[] = [];

  for (const cfg of DEDICATED_LOG_CHANNELS) {
    const chan = await guild.channels.create({
      name: cfg.name,
      type: ChannelType.GuildText,
      parent: category.id,
      topic: cfg.topic,
    });
    await store.setLogChannel(guild.id, cfg.key, chan.id);
    channelsCreated.push(`<#${chan.id}> (${cfg.key})`);
  }

  return { categoryName: category.name, channelsCreated };
}

export function createLoggingCommands(
  store: ILoggingStore = new MemoryLoggingStore(),
): CommandDefinition[] {
  const loggingCmd: CommandDefinition = {
    name: 'logging',
    description: 'Manage automated server audit logging.',
    data: new SlashCommandBuilder()
      .setName('logging')
      .setDescription('Configure server audit logging channels.')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addSubcommand((sub) =>
        sub
          .setName('setup')
          .setDescription(
            'One-click automatic log setup: creates RIFFLY LOGS category and 6 dedicated channels.',
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName('set')
          .setDescription('Assign a custom log channel for a specific event type.')
          .addChannelOption((opt) =>
            opt
              .setName('channel')
              .setDescription('Target text channel')
              .addChannelTypes(ChannelType.GuildText)
              .setRequired(true),
          )
          .addStringOption((opt) =>
            opt
              .setName('event_type')
              .setDescription('Log category (defaults to all server logs)')
              .setRequired(false)
              .addChoices(
                { name: 'All Server Events (Default)', value: 'all' },
                { name: 'Message Events', value: 'message' },
                { name: 'Voice Events', value: 'voice' },
                { name: 'Member Events', value: 'member' },
                { name: 'Moderation Events', value: 'mod' },
                { name: 'Server Events', value: 'server' },
                { name: 'Bot Events', value: 'bot' },
              ),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName('disable')
          .setDescription('Disable logging for a specific event type or all.')
          .addStringOption((opt) =>
            opt
              .setName('event_type')
              .setDescription('Category to disable')
              .setRequired(true)
              .addChoices(
                { name: 'All Categories', value: 'all' },
                { name: 'Message Events', value: 'message' },
                { name: 'Voice Events', value: 'voice' },
                { name: 'Member Events', value: 'member' },
                { name: 'Moderation Events', value: 'mod' },
                { name: 'Server Events', value: 'server' },
                { name: 'Bot Events', value: 'bot' },
              ),
          ),
      )
      .addSubcommand((sub) =>
        sub.setName('view').setDescription('View currently configured log channels.'),
      ),
    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({ content: '❌ Guild only.', ephemeral: true });
        return;
      }

      const sub = interaction.options.getSubcommand();

      if (sub === 'setup') {
        await interaction.deferReply();
        const res = await executeOneClickLogSetup(interaction.guild, store);
        const embed = new EmbedBuilder()
          .setTitle('📁 Automatic Logging Infrastructure Configured')
          .setColor(0x57f287)
          .setDescription(
            `Successfully deployed private category **${res.categoryName}** with dedicated log channels:\n\n` +
              res.channelsCreated.map((c) => `• ${c}`).join('\n'),
          )
          .setFooter({ text: 'Riffly • Audit Engine' });

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (sub === 'set') {
        const eventType = interaction.options.getString('event_type') ?? 'all';
        const chan = interaction.options.getChannel<ChannelType.GuildText>('channel', true);
        await store.setLogChannel(interaction.guild.id, eventType, chan.id);
        const embed = new EmbedBuilder()
          .setTitle('📁 Audit Log Channel Configured')
          .setColor(0x57f287)
          .setDescription(
            `Mapped event type **${eventType.toUpperCase()}** to <#${chan.id}>.\n` +
              (eventType === 'all'
                ? `All server events (messages, voice, members, moderation, channels, commands) will now be logged here.`
                : `Specific events for **${eventType}** will now be logged here.`),
          )
          .setFooter({ text: 'Riffly • Audit Engine' })
          .setTimestamp();
        await interaction.reply({ embeds: [embed] });
        return;
      }

      if (sub === 'disable') {
        const eventType = interaction.options.getString('event_type', true);
        await store.disableLog(interaction.guild.id, eventType);
        await interaction.reply({
          content: `🛑 Disabled audit logging for **${eventType}**.`,
        });
        return;
      }

      if (sub === 'view') {
        const channels = await store.getLogChannels(interaction.guild.id);
        const lines = DEDICATED_LOG_CHANNELS.map((c) => {
          const chanId = channels[c.key];
          return `• **${c.key.toUpperCase()}**: ${chanId ? `<#${chanId}>` : '`Not Configured`'}`;
        });

        const embed = new EmbedBuilder()
          .setTitle('📊 Configured Audit Log Channels')
          .setColor(0x5865f2)
          .setDescription(lines.join('\n'));

        await interaction.reply({ embeds: [embed] });
      }
    },
  };

  const loggingsetCmd: CommandDefinition = {
    name: 'loggingset',
    description: 'Set target audit log channel for server events.',
    data: new SlashCommandBuilder()
      .setName('loggingset')
      .setDescription('Set target audit log channel for server events.')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addChannelOption((opt) =>
        opt
          .setName('channel')
          .setDescription('Target text channel where logs will be displayed')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true),
      )
      .addStringOption((opt) =>
        opt
          .setName('event_type')
          .setDescription('Log category (defaults to all server logs)')
          .setRequired(false)
          .addChoices(
            { name: 'All Server Events (Default)', value: 'all' },
            { name: 'Message Events (Delete/Edit)', value: 'message' },
            { name: 'Voice Events (Join/Leave/Move)', value: 'voice' },
            { name: 'Member Events (Join/Leave/Roles)', value: 'member' },
            { name: 'Moderation Events (Ban/Kick/Warn)', value: 'mod' },
            { name: 'Server Events (Channels/Roles)', value: 'server' },
            { name: 'Bot Events (Commands/System)', value: 'bot' },
          ),
      ),
    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({ content: '❌ Guild only.', ephemeral: true });
        return;
      }
      const chan = interaction.options.getChannel<ChannelType.GuildText>('channel', true);
      const eventType = interaction.options.getString('event_type') ?? 'all';

      await store.setLogChannel(interaction.guild.id, eventType, chan.id);

      const embed = new EmbedBuilder()
        .setTitle('📁 Audit Log Channel Configured')
        .setColor(0x57f287)
        .setDescription(
          `Mapped event type **${eventType.toUpperCase()}** to <#${chan.id}>.\n\n` +
            (eventType === 'all'
              ? `✅ **Every server event** (messages, voice, members, moderation, channels, commands) will now be displayed here!`
              : `✅ Specific events for **${eventType}** will now be displayed here!`),
        )
        .addFields(
          { name: 'Target Channel', value: `<#${chan.id}>`, inline: true },
          { name: 'Event Category', value: `\`${eventType.toUpperCase()}\``, inline: true },
          { name: 'Status', value: '🟢 Active & Logging', inline: true },
        )
        .setFooter({ text: 'Riffly • Realtime Audit Engine' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    },
  };

  const setupLogsCmd: CommandDefinition = {
    name: 'setup-logs',
    description: 'Instant one-click private category + 6 log channels setup.',
    data: new SlashCommandBuilder()
      .setName('setup-logs')
      .setDescription('Instant one-click private category + 6 log channels setup.')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.inGuild() || !interaction.guild) {
        await interaction.reply({ content: '❌ Guild only.', ephemeral: true });
        return;
      }
      await interaction.deferReply();
      const res = await executeOneClickLogSetup(interaction.guild, store);
      const embed = new EmbedBuilder()
        .setTitle('📁 Automatic Logging Infrastructure Configured')
        .setColor(0x57f287)
        .setDescription(
          `Successfully deployed private category **${res.categoryName}** with dedicated log channels:\n\n` +
            res.channelsCreated.map((c) => `• ${c}`).join('\n'),
        )
        .setFooter({ text: 'Riffly • Audit Engine' });

      await interaction.editReply({ embeds: [embed] });
    },
  };

  return [loggingCmd, loggingsetCmd, setupLogsCmd];
}
