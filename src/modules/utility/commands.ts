import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { CommandDefinition } from '../core/types.js';
import type { TaskScheduler } from '../../scheduler/task-scheduler.js';

const NUMBER_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

function parseDuration(str: string): number | null {
  const match = str.trim().match(/^(\d+)\s*(s|m|h|d)$/i);
  if (!match) return null;
  const num = parseInt(match[1] ?? '0', 10);
  const unit = (match[2] ?? '').toLowerCase();
  switch (unit) {
    case 's':
      return num * 1000;
    case 'm':
      return num * 60 * 1000;
    case 'h':
      return num * 3600 * 1000;
    case 'd':
      return num * 86400 * 1000;
    default:
      return null;
  }
}

export function createUtilityCommands(scheduler?: TaskScheduler): CommandDefinition[] {
  const userinfoCmd: CommandDefinition = {
    name: 'userinfo',
    description: 'Displays detailed information about a server member or yourself.',
    data: new SlashCommandBuilder()
      .setName('userinfo')
      .setDescription('Displays detailed information about a server member or yourself.')
      .addUserOption((opt) =>
        opt.setName('target').setDescription('The user to view details for').setRequired(false),
      ),
    guildOnly: true,
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: false });

      const targetUser = interaction.options.getUser('target') ?? interaction.user;
      const member = interaction.guild?.members.cache.get(targetUser.id);

      const embed = new EmbedBuilder()
        .setTitle(`User Profile: ${targetUser.username}`)
        .setColor(0x3b82f6)
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
          { name: 'User ID', value: `\`${targetUser.id}\``, inline: true },
          { name: 'Bot Account', value: targetUser.bot ? 'Yes' : 'No', inline: true },
          {
            name: 'Account Created',
            value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>`,
            inline: true,
          },
        );

      if (member) {
        embed.addFields(
          {
            name: 'Joined Server',
            value: member.joinedTimestamp
              ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`
              : 'Unknown',
            inline: true,
          },
          {
            name: 'Highest Role',
            value: member.roles.highest ? `<@&${member.roles.highest.id}>` : '@everyone',
            inline: true,
          },
          {
            name: `Roles (${member.roles.cache.size - 1})`,
            value:
              Array.from(member.roles.cache.values())
                .filter((r) => r.id !== interaction.guildId)
                .map((r) => `<@&${r.id}>`)
                .slice(0, 15)
                .join(', ') || 'None',
          },
        );
      }

      await interaction.editReply({ embeds: [embed] });
    },
  };

  const serverinfoCmd: CommandDefinition = {
    name: 'serverinfo',
    description: 'Displays information and statistics about this Discord server.',
    data: new SlashCommandBuilder()
      .setName('serverinfo')
      .setDescription('Displays information and statistics about this Discord server.'),
    guildOnly: true,
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: false });

      const guild = interaction.guild;
      if (!guild) {
        await interaction.editReply({ content: 'This command can only be used in a server.' });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(guild.name)
        .setColor(0x3b82f6)
        .setThumbnail(guild.iconURL() ?? null)
        .addFields(
          { name: 'Server ID', value: `\`${guild.id}\``, inline: true },
          { name: 'Owner', value: `<@${guild.ownerId}>`, inline: true },
          {
            name: 'Created',
            value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`,
            inline: true,
          },
          { name: 'Total Members', value: `${guild.memberCount}`, inline: true },
          {
            name: 'Channels',
            value: `${guild.channels.cache.size} total channels`,
            inline: true,
          },
          {
            name: 'Boost Level',
            value: `Tier ${guild.premiumTier} (${guild.premiumSubscriptionCount ?? 0} boosts)`,
            inline: true,
          },
        )
        .setFooter({ text: 'Riffly Server Statistics' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    },
  };

  const avatarCmd: CommandDefinition = {
    name: 'avatar',
    description: 'Displays a user avatar in full resolution with format download links.',
    data: new SlashCommandBuilder()
      .setName('avatar')
      .setDescription('Displays a user avatar in full resolution with format download links.')
      .addUserOption((opt) =>
        opt.setName('target').setDescription('User whose avatar to display').setRequired(false),
      ),
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: false });

      const targetUser = interaction.options.getUser('target') ?? interaction.user;
      const avatarUrl = targetUser.displayAvatarURL({ size: 1024 });

      const embed = new EmbedBuilder()
        .setTitle(`${targetUser.username}'s Avatar`)
        .setColor(0x3b82f6)
        .setImage(avatarUrl)
        .setDescription(
          `[PNG](${targetUser.displayAvatarURL({ extension: 'png', size: 1024 })}) | ` +
            `[WEBP](${targetUser.displayAvatarURL({ extension: 'webp', size: 1024 })}) | ` +
            `[JPG](${targetUser.displayAvatarURL({ extension: 'jpeg', size: 1024 })})`,
        );

      await interaction.editReply({ embeds: [embed] });
    },
  };

  const pollCmd: CommandDefinition = {
    name: 'poll',
    description: 'Creates a multiple-choice community poll.',
    data: new SlashCommandBuilder()
      .setName('poll')
      .setDescription('Creates a multiple-choice community poll.')
      .addStringOption((opt) =>
        opt.setName('question').setDescription('The question to vote on').setRequired(true),
      )
      .addStringOption((opt) =>
        opt
          .setName('options')
          .setDescription('Comma-separated choices (up to 10 choices)')
          .setRequired(true),
      ),
    guildOnly: true,
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: false });

      const question = interaction.options.getString('question', true);
      const rawOptions = interaction.options.getString('options', true);

      const choices = rawOptions
        .split(',')
        .map((c) => c.trim())
        .filter((c) => c.length > 0);

      if (choices.length < 2 || choices.length > 10) {
        await interaction.editReply({
          content: '❌ Please provide between 2 and 10 options separated by commas.',
        });
        return;
      }

      const formattedChoices = choices
        .map((choice, idx) => `${NUMBER_EMOJIS[idx]} ${choice}`)
        .join('\n\n');

      const embed = new EmbedBuilder()
        .setTitle(`📊 Poll: ${question}`)
        .setColor(0x6366f1)
        .setDescription(formattedChoices)
        .setFooter({ text: `Asked by ${interaction.user.username} • React to cast your vote` })
        .setTimestamp();

      const message = await interaction.editReply({ embeds: [embed] });

      for (let i = 0; i < choices.length; i++) {
        const emoji = NUMBER_EMOJIS[i];
        if (emoji && 'react' in message && typeof message.react === 'function') {
          await message.react(emoji).catch(() => null);
        }
      }
    },
  };

  const remindCmd: CommandDefinition = {
    name: 'remindme',
    description: 'Sets a personal delayed reminder notification.',
    data: new SlashCommandBuilder()
      .setName('remindme')
      .setDescription('Sets a personal delayed reminder notification.')
      .addStringOption((opt) =>
        opt
          .setName('duration')
          .setDescription('When to remind you (e.g. 10m, 2h, 1d)')
          .setRequired(true),
      )
      .addStringOption((opt) =>
        opt.setName('reason').setDescription('What to remind you about').setRequired(true),
      ),
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: true });

      const durationStr = interaction.options.getString('duration', true);
      const reason = interaction.options.getString('reason', true);

      const durationMs = parseDuration(durationStr);
      if (!durationMs || durationMs < 5000) {
        await interaction.editReply({
          content: '❌ Invalid duration. Must be at least 5 seconds (e.g. `10m`, `1h`, `1d`).',
        });
        return;
      }

      const remindAt = new Date(Date.now() + durationMs);

      if (scheduler && interaction.guildId) {
        await scheduler.scheduleTask({
          guildId: interaction.guildId,
          taskType: 'reminder',
          payload: {
            userId: interaction.user.id,
            channelId: interaction.channelId,
            reason,
          },
          executeAt: remindAt,
        });
      }

      await interaction.editReply({
        content: `⏰ Reminder set! I will notify you for: **"${reason}"** <t:${Math.floor(remindAt.getTime() / 1000)}:R>.`,
      });
    },
  };

  return [userinfoCmd, serverinfoCmd, avatarCmd, pollCmd, remindCmd];
}
