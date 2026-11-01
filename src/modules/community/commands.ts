import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type ColorResolvable,
  type GuildMember,
} from 'discord.js';
import type { CommandDefinition } from '../core/types.js';
import type { CommunityService } from './service.js';

export function createCommunityCommands(service: CommunityService): CommandDefinition[] {
  // 1. /autorole
  const autoroleCommand: CommandDefinition = {
    name: 'autorole',
    description: 'Manage automated roles granted to new members upon joining.',
    data: new SlashCommandBuilder()
      .setName('autorole')
      .setDescription('Manage automated roles granted to new members upon joining.')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
      .addSubcommand((sub) =>
        sub
          .setName('add')
          .setDescription('Add an automatic role for newcomers')
          .addRoleOption((opt) =>
            opt.setName('role').setDescription('Role to assign').setRequired(true),
          )
          .addStringOption((opt) =>
            opt
              .setName('target')
              .setDescription('Target recipients')
              .addChoices(
                { name: 'All members', value: 'all' },
                { name: 'Humans only', value: 'humans' },
                { name: 'Bots only', value: 'bots' },
              ),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName('remove')
          .setDescription('Remove an automatic role')
          .addRoleOption((opt) =>
            opt.setName('role').setDescription('Role to remove').setRequired(true),
          ),
      )
      .addSubcommand((sub) => sub.setName('list').setDescription('List all configured autoroles')),
    guildOnly: true,
    defaultMemberPermissions: PermissionFlagsBits.ManageRoles,
    execute: async (interaction: ChatInputCommandInteraction) => {
      await interaction.deferReply({ ephemeral: true });
      const guild = interaction.guild;
      if (!guild) {
        await interaction.editReply('Must be run in a server.');
        return;
      }

      const sub = interaction.options.getSubcommand();

      if (sub === 'add') {
        const role = interaction.options.getRole('role', true);
        const target = interaction.options.getString('target') ?? 'all';
        await service.addAutoRole(guild.id, role.id, target);
        await interaction.editReply(
          `✅ Added <@&${role.id}> as an automatic role for **${target}**.`,
        );
        return;
      }

      if (sub === 'remove') {
        const role = interaction.options.getRole('role', true);
        const ok = await service.removeAutoRole(guild.id, role.id);
        if (ok) {
          await interaction.editReply(`Removed <@&${role.id}> from automatic roles.`);
        } else {
          await interaction.editReply('That role is not registered as an autorole.');
        }
        return;
      }

      if (sub === 'list') {
        const list = await service.listAutoRoles(guild.id);
        if (list.length === 0) {
          await interaction.editReply('No autoroles configured.');
          return;
        }
        const embed = new EmbedBuilder()
          .setTitle('🎭 Active AutoRoles')
          .setColor(0x6366f1)
          .setDescription(list.map((r) => `• <@&${r.roleId}> (\`${r.targetType}\`)`).join('\n'));
        await interaction.editReply({ embeds: [embed] });
      }
    },
  };

  // 2. /reactionrole
  const reactionroleCommand: CommandDefinition = {
    name: 'reactionrole',
    description: 'Configure interactive reaction-based self roles.',
    data: new SlashCommandBuilder()
      .setName('reactionrole')
      .setDescription('Configure interactive reaction-based self roles.')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
      .addSubcommand((sub) =>
        sub
          .setName('create')
          .setDescription('Link an emoji reaction to a self role on a message')
          .addChannelOption((opt) =>
            opt
              .setName('channel')
              .setDescription('Channel containing message')
              .addChannelTypes(ChannelType.GuildText)
              .setRequired(true),
          )
          .addStringOption((opt) =>
            opt.setName('message_id').setDescription('Target message ID').setRequired(true),
          )
          .addStringOption((opt) =>
            opt.setName('emoji').setDescription('Emoji to react with').setRequired(true),
          )
          .addRoleOption((opt) =>
            opt.setName('role').setDescription('Role to grant').setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName('remove')
          .setDescription('Remove a reaction role mapping')
          .addStringOption((opt) =>
            opt.setName('message_id').setDescription('Target message ID').setRequired(true),
          )
          .addStringOption((opt) =>
            opt.setName('emoji').setDescription('Emoji to remove').setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub.setName('list').setDescription('List all reaction roles in this server'),
      )
      .addSubcommand((sub) =>
        sub
          .setName('delete')
          .setDescription('Delete all reaction roles attached to a message ID')
          .addStringOption((opt) =>
            opt.setName('message_id').setDescription('Message ID').setRequired(true),
          ),
      ),
    guildOnly: true,
    defaultMemberPermissions: PermissionFlagsBits.ManageRoles,
    execute: async (interaction: ChatInputCommandInteraction) => {
      await interaction.deferReply({ ephemeral: true });
      const guild = interaction.guild;
      if (!guild) {
        await interaction.editReply('Must be run in a server.');
        return;
      }

      const sub = interaction.options.getSubcommand();

      if (sub === 'create') {
        const channel = interaction.options.getChannel<ChannelType.GuildText>('channel', true);
        const msgId = interaction.options.getString('message_id', true);
        const emoji = interaction.options.getString('emoji', true);
        const role = interaction.options.getRole('role', true);

        await service.addReactionRole(guild.id, channel.id, msgId, emoji, role.id);
        const targetMsg = await channel.messages.fetch(msgId).catch(() => null);
        if (targetMsg) {
          await targetMsg.react(emoji).catch(() => null);
        }

        await interaction.editReply(
          `✅ Reaction role configured: ${emoji} grants <@&${role.id}> on message \`${msgId}\`.`,
        );
        return;
      }

      if (sub === 'remove') {
        const msgId = interaction.options.getString('message_id', true);
        const emoji = interaction.options.getString('emoji', true);
        const ok = await service.removeReactionRole(guild.id, msgId, emoji);
        await interaction.editReply(
          ok ? `Reaction role removed for ${emoji}.` : 'Mapping not found.',
        );
        return;
      }

      if (sub === 'delete') {
        const msgId = interaction.options.getString('message_id', true);
        const ok = await service.deleteReactionRole(guild.id, msgId);
        await interaction.editReply(
          ok ? `All reaction roles deleted for message \`${msgId}\`.` : 'None found.',
        );
        return;
      }

      if (sub === 'list') {
        const list = await service.listReactionRoles(guild.id);
        if (list.length === 0) {
          await interaction.editReply('No reaction roles found.');
          return;
        }
        const embed = new EmbedBuilder()
          .setTitle('✨ Active Reaction Roles')
          .setColor(0x6366f1)
          .setDescription(
            list
              .map(
                (rr) =>
                  `• Msg \`${rr.messageId}\` in <#${rr.channelId}>: ${rr.emoji} -> <@&${rr.roleId}>`,
              )
              .join('\n'),
          );
        await interaction.editReply({ embeds: [embed] });
      }
    },
  };

  // 3. /vanityrole
  const vanityroleCommand: CommandDefinition = {
    name: 'vanityrole',
    description:
      'Reward users with a role when they feature your server invite or custom text in their status.',
    data: new SlashCommandBuilder()
      .setName('vanityrole')
      .setDescription(
        'Reward users with a role when they feature your server invite in their status.',
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
      .addSubcommand((sub) =>
        sub
          .setName('add')
          .setDescription('Add status keyword mapping to role')
          .addStringOption((opt) =>
            opt
              .setName('keyword')
              .setDescription('Status keyword/link to detect')
              .setRequired(true),
          )
          .addRoleOption((opt) =>
            opt.setName('role').setDescription('Role to award').setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName('remove')
          .setDescription('Remove a vanity role keyword')
          .addStringOption((opt) =>
            opt.setName('keyword').setDescription('Keyword to remove').setRequired(true),
          ),
      )
      .addSubcommand((sub) => sub.setName('list').setDescription('List vanity role rewards')),
    guildOnly: true,
    defaultMemberPermissions: PermissionFlagsBits.ManageRoles,
    execute: async (interaction: ChatInputCommandInteraction) => {
      await interaction.deferReply({ ephemeral: true });
      const guild = interaction.guild;
      if (!guild) {
        await interaction.editReply('Must be run in a server.');
        return;
      }

      const sub = interaction.options.getSubcommand();

      if (sub === 'add') {
        const keyword = interaction.options.getString('keyword', true);
        const role = interaction.options.getRole('role', true);
        await service.addVanityRole(guild.id, keyword, role.id);
        await interaction.editReply(
          `✅ Members with **${keyword}** in their custom status will receive <@&${role.id}>.`,
        );
        return;
      }

      if (sub === 'remove') {
        const keyword = interaction.options.getString('keyword', true);
        const ok = await service.removeVanityRole(guild.id, keyword);
        await interaction.editReply(
          ok ? `Removed vanity rule for **${keyword}**.` : 'Keyword not found.',
        );
        return;
      }

      if (sub === 'list') {
        const list = await service.listVanityRoles(guild.id);
        if (list.length === 0) {
          await interaction.editReply('No vanity roles configured.');
          return;
        }
        const embed = new EmbedBuilder()
          .setTitle('💎 Vanity Role Rewards')
          .setColor(0xec4899)
          .setDescription(list.map((vr) => `• \`${vr.keyword}\` -> <@&${vr.roleId}>`).join('\n'));
        await interaction.editReply({ embeds: [embed] });
      }
    },
  };

  // 4. /clownboard
  const clownboardCommand: CommandDefinition = {
    name: 'clownboard',
    description: 'Configure clown reaction highlights on your server.',
    data: new SlashCommandBuilder()
      .setName('clownboard')
      .setDescription('Configure clown reaction highlights on your server.')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addSubcommand((sub) =>
        sub
          .setName('setup')
          .setDescription('Configure clownboard destination channel and threshold')
          .addChannelOption((opt) =>
            opt
              .setName('channel')
              .setDescription('Channel to post clown highlights')
              .addChannelTypes(ChannelType.GuildText)
              .setRequired(true),
          )
          .addStringOption((opt) =>
            opt.setName('emoji').setDescription('Reaction emoji (default 🤡)'),
          )
          .addIntegerOption((opt) =>
            opt
              .setName('threshold')
              .setDescription('Reactions required (default 3)')
              .setMinValue(1)
              .setMaxValue(25),
          ),
      )
      .addSubcommand((sub) =>
        sub.setName('disable').setDescription('Disable clownboard highlights'),
      )
      .addSubcommand((sub) =>
        sub.setName('view').setDescription('View current clownboard configuration'),
      )
      .addSubcommand((sub) => sub.setName('leaderboard').setDescription('View top clown moments')),
    guildOnly: true,
    defaultMemberPermissions: PermissionFlagsBits.ManageGuild,
    execute: async (interaction: ChatInputCommandInteraction) => {
      await interaction.deferReply({ ephemeral: true });
      const guild = interaction.guild;
      if (!guild) {
        await interaction.editReply('Must be run in a server.');
        return;
      }

      const sub = interaction.options.getSubcommand();

      if (sub === 'setup') {
        const channel = interaction.options.getChannel<ChannelType.GuildText>('channel', true);
        const threshold = interaction.options.getInteger('threshold') ?? 3;

        await service.setupClownboard(guild.id, channel.id, threshold);
        await interaction.editReply(
          `🤡 **Clownboard Active:** Messages reaching ${threshold} 🤡 will be posted to <#${channel.id}>.`,
        );
        return;
      }

      if (sub === 'disable') {
        await service.disableClownboard(guild.id);
        await interaction.editReply('Clownboard disabled.');
        return;
      }

      if (sub === 'view') {
        const cfg = await service.getClownboard(guild.id);
        if (!cfg) {
          await interaction.editReply('Clownboard is not configured.');
          return;
        }
        const embed = new EmbedBuilder()
          .setTitle('🤡 Clownboard Settings')
          .setColor(0xf59e0b)
          .addFields(
            { name: 'Status', value: cfg.enabled ? '🟢 Enabled' : '🔴 Disabled', inline: true },
            { name: 'Channel', value: `<#${cfg.channelId}>`, inline: true },
            { name: 'Threshold', value: `${cfg.threshold} 🤡`, inline: true },
          );
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (sub === 'leaderboard') {
        await interaction.editReply(
          '🤡 Top clowns leaderboard will be populated as highlights occur.',
        );
      }
    },
  };

  // 5. /counter
  const counterCommand: CommandDefinition = {
    name: 'counter',
    description: 'Setup and manage an automated counting channel.',
    data: new SlashCommandBuilder()
      .setName('counter')
      .setDescription('Setup and manage an automated counting channel.')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addSubcommand((sub) =>
        sub
          .setName('setup')
          .setDescription('Set designated channel for counting game')
          .addChannelOption((opt) =>
            opt
              .setName('channel')
              .setDescription('Channel')
              .addChannelTypes(ChannelType.GuildText)
              .setRequired(true),
          ),
      )
      .addSubcommand((sub) => sub.setName('reset').setDescription('Reset the current count to 0'))
      .addSubcommand((sub) => sub.setName('disable').setDescription('Disable counting game'))
      .addSubcommand((sub) =>
        sub.setName('view').setDescription('View current counting status and record'),
      ),
    guildOnly: true,
    defaultMemberPermissions: PermissionFlagsBits.ManageGuild,
    execute: async (interaction: ChatInputCommandInteraction) => {
      await interaction.deferReply({ ephemeral: true });
      const guild = interaction.guild;
      if (!guild) {
        await interaction.editReply('Must be run in a server.');
        return;
      }

      const sub = interaction.options.getSubcommand();

      if (sub === 'setup') {
        const channel = interaction.options.getChannel<ChannelType.GuildText>('channel', true);
        await service.setupCounting(guild.id, channel.id);
        await interaction.editReply(
          `🔢 Counting game enabled in <#${channel.id}>! Next number is **1**.`,
        );
        return;
      }

      if (sub === 'reset') {
        await service.resetCounting(guild.id);
        await interaction.editReply('🔢 Counting progress reset to **0**.');
        return;
      }

      if (sub === 'disable') {
        await service.disableCounting(guild.id);
        await interaction.editReply('Counting channel disabled.');
        return;
      }

      if (sub === 'view') {
        const cfg = await service.getCounting(guild.id);
        if (!cfg) {
          await interaction.editReply('No counting channel configured.');
          return;
        }
        const embed = new EmbedBuilder()
          .setTitle('🔢 Counting Channel Status')
          .setColor(0x10b981)
          .addFields(
            { name: 'Channel', value: `<#${cfg.channelId}>`, inline: true },
            { name: 'Current Count', value: `\`${cfg.currentNumber}\``, inline: true },
          );
        await interaction.editReply({ embeds: [embed] });
      }
    },
  };

  // 6. /autoresponder
  const autoresponderCommand: CommandDefinition = {
    name: 'autoresponder',
    description: 'Create automated message responses based on triggers.',
    data: new SlashCommandBuilder()
      .setName('autoresponder')
      .setDescription('Create automated message responses based on triggers.')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addSubcommand((sub) =>
        sub
          .setName('add')
          .setDescription('Create a new automated trigger response')
          .addStringOption((opt) =>
            opt.setName('trigger').setDescription('Trigger phrase').setRequired(true),
          )
          .addStringOption((opt) =>
            opt.setName('response').setDescription('Bot response').setRequired(true),
          )
          .addStringOption((opt) =>
            opt
              .setName('match_mode')
              .setDescription('How the trigger is checked')
              .addChoices(
                { name: 'Exact match', value: 'exact' },
                { name: 'Contains phrase', value: 'contains' },
                { name: 'Starts with', value: 'startswith' },
              ),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName('remove')
          .setDescription('Remove an automated responder')
          .addStringOption((opt) =>
            opt.setName('trigger').setDescription('Trigger phrase').setRequired(true),
          ),
      )
      .addSubcommand((sub) => sub.setName('list').setDescription('List all active autoresponders'))
      .addSubcommand((sub) => sub.setName('clear').setDescription('Clear all autoresponders'))
      .addSubcommand((sub) =>
        sub
          .setName('test')
          .setDescription('Simulate trigger evaluation')
          .addStringOption((opt) =>
            opt.setName('text').setDescription('Test phrase').setRequired(true),
          ),
      ),
    guildOnly: true,
    defaultMemberPermissions: PermissionFlagsBits.ManageGuild,
    execute: async (interaction: ChatInputCommandInteraction) => {
      await interaction.deferReply({ ephemeral: true });
      const guild = interaction.guild;
      if (!guild) {
        await interaction.editReply('Must be run in a server.');
        return;
      }

      const sub = interaction.options.getSubcommand();

      if (sub === 'add') {
        const trigger = interaction.options.getString('trigger', true);
        const resp = interaction.options.getString('response', true);
        const mode = interaction.options.getString('match_mode') ?? 'exact';

        await service.addAutoResponder(guild.id, trigger, resp, mode);
        await interaction.editReply(`✅ Autoresponder added for \`${trigger}\` [${mode}].`);
        return;
      }

      if (sub === 'remove') {
        const trigger = interaction.options.getString('trigger', true);
        const ok = await service.removeAutoResponder(guild.id, trigger);
        await interaction.editReply(
          ok ? `Autoresponder for \`${trigger}\` removed.` : 'Trigger not found.',
        );
        return;
      }

      if (sub === 'clear') {
        const count = await service.clearAutoResponders(guild.id);
        await interaction.editReply(`Cleared ${count} autoresponders.`);
        return;
      }

      if (sub === 'list') {
        const list = await service.listAutoResponders(guild.id);
        if (list.length === 0) {
          await interaction.editReply('No autoresponders configured.');
          return;
        }
        const embed = new EmbedBuilder()
          .setTitle('🤖 Active AutoResponders')
          .setColor(0x3b82f6)
          .setDescription(
            list.map((ar) => `• \`${ar.trigger}\` [${ar.matchType}] -> "${ar.reply}"`).join('\n'),
          );
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (sub === 'test') {
        const text = interaction.options.getString('text', true);
        const match = await service.evaluateAutoResponder(guild.id, text);
        await interaction.editReply(
          match ? `Trigger matched! Response: "${match}"` : 'No trigger matched.',
        );
      }
    },
  };

  // 7. /invites
  const invitesCommand: CommandDefinition = {
    name: 'invites',
    description: 'Check invite statistics for yourself or another user.',
    data: new SlashCommandBuilder()
      .setName('invites')
      .setDescription('Check invite statistics for yourself or another user.')
      .addUserOption((opt) => opt.setName('user').setDescription('Target user')),
    guildOnly: true,
    execute: async (interaction: ChatInputCommandInteraction) => {
      await interaction.deferReply({ ephemeral: false });
      const guild = interaction.guild;
      if (!guild) {
        await interaction.editReply('Must be run in a server.');
        return;
      }

      const target = interaction.options.getUser('user') ?? interaction.user;
      const stats = await service.getInvites(guild.id, target.id);

      const embed = new EmbedBuilder()
        .setTitle(`📨 Invites — ${target.username}`)
        .setColor(0x10b981)
        .setThumbnail(target.displayAvatarURL())
        .setDescription(`**${target.username}** currently has **${stats.total}** total invites.`)
        .addFields(
          { name: 'Joins', value: `${stats.joins}`, inline: true },
          { name: 'Leaves', value: `${stats.leaves}`, inline: true },
          { name: 'Fake', value: `${stats.fake}`, inline: true },
        )
        .setFooter({ text: 'Riffly Invite Tracker' });

      await interaction.editReply({ embeds: [embed] });
    },
  };

  // 8. /timer
  const timerCommand: CommandDefinition = {
    name: 'timer',
    description: 'Set countdown timers with notification alerts.',
    data: new SlashCommandBuilder()
      .setName('timer')
      .setDescription('Set countdown timers with notification alerts.')
      .addSubcommand((sub) =>
        sub
          .setName('create')
          .setDescription('Start a new timer')
          .addStringOption((opt) =>
            opt.setName('name').setDescription('Timer name/label').setRequired(true),
          )
          .addIntegerOption((opt) =>
            opt
              .setName('duration')
              .setDescription('Duration in seconds')
              .setMinValue(5)
              .setMaxValue(86400)
              .setRequired(true),
          ),
      )
      .addSubcommand((sub) => sub.setName('list').setDescription('List your active timers'))
      .addSubcommand((sub) =>
        sub
          .setName('cancel')
          .setDescription('Cancel an active timer')
          .addStringOption((opt) =>
            opt.setName('name').setDescription('Timer name').setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName('pause')
          .setDescription('Pause an active timer')
          .addStringOption((opt) =>
            opt.setName('name').setDescription('Timer name').setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName('resume')
          .setDescription('Resume a paused timer')
          .addStringOption((opt) =>
            opt.setName('name').setDescription('Timer name').setRequired(true),
          ),
      ),
    guildOnly: true,
    execute: async (interaction: ChatInputCommandInteraction) => {
      await interaction.deferReply({ ephemeral: true });
      const guild = interaction.guild;
      if (!guild) {
        await interaction.editReply('Must be run in a server.');
        return;
      }

      const sub = interaction.options.getSubcommand();

      if (sub === 'create') {
        const name = interaction.options.getString('name', true);
        const duration = interaction.options.getInteger('duration', true);

        const timer = await service.createTimer(
          guild.id,
          interaction.channelId,
          name,
          duration,
          interaction.user.id,
        );
        await interaction.editReply(`⏱️ Timer **${timer.name}** set for **${duration}s**!`);
        return;
      }

      if (sub === 'list') {
        const timers = await service.listTimers(guild.id);
        if (timers.length === 0) {
          await interaction.editReply('No active timers.');
          return;
        }
        const embed = new EmbedBuilder()
          .setTitle('⏱️ Active Timers')
          .setColor(0x6366f1)
          .setDescription(
            timers
              .map(
                (t) =>
                  `• **${t.name}**: <#${t.channelId}> — ${t.paused ? '⏸️ Paused' : `Ends <t:${Math.floor(t.endsAt.getTime() / 1000)}:R>`}`,
              )
              .join('\n'),
          );
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (sub === 'cancel') {
        const name = interaction.options.getString('name', true);
        const ok = await service.cancelTimer(guild.id, name);
        await interaction.editReply(ok ? `Timer **${name}** cancelled.` : 'Timer not found.');
        return;
      }

      if (sub === 'pause') {
        const name = interaction.options.getString('name', true);
        const ok = await service.pauseTimer(guild.id, name);
        await interaction.editReply(ok ? `Timer **${name}** paused.` : 'Could not pause timer.');
        return;
      }

      if (sub === 'resume') {
        const name = interaction.options.getString('name', true);
        const ok = await service.resumeTimer(guild.id, name);
        await interaction.editReply(ok ? `Timer **${name}** resumed.` : 'Could not resume timer.');
      }
    },
  };

  // 9. /bumper
  const bumperCommand: CommandDefinition = {
    name: 'bumper',
    description: 'Configure automated bump reminders for server discovery bots.',
    data: new SlashCommandBuilder()
      .setName('bumper')
      .setDescription('Configure automated bump reminders for server discovery bots.')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addSubcommand((sub) =>
        sub
          .setName('setup')
          .setDescription('Configure reminder channel and ping role')
          .addChannelOption((opt) =>
            opt
              .setName('channel')
              .setDescription('Channel for reminder')
              .addChannelTypes(ChannelType.GuildText)
              .setRequired(true),
          )
          .addRoleOption((opt) => opt.setName('role').setDescription('Role to ping')),
      )
      .addSubcommand((sub) => sub.setName('disable').setDescription('Disable bump reminders'))
      .addSubcommand((sub) => sub.setName('view').setDescription('View bumper configuration'))
      .addSubcommand((sub) =>
        sub.setName('bump').setDescription('Record manual bump and reset 2-hour timer'),
      ),
    guildOnly: true,
    defaultMemberPermissions: PermissionFlagsBits.ManageGuild,
    execute: async (interaction: ChatInputCommandInteraction) => {
      await interaction.deferReply({ ephemeral: true });
      const guild = interaction.guild;
      if (!guild) {
        await interaction.editReply('Must be run in a server.');
        return;
      }

      const sub = interaction.options.getSubcommand();

      if (sub === 'setup') {
        const channel = interaction.options.getChannel<ChannelType.GuildText>('channel', true);

        await service.setupBumpReminder(guild.id, channel.id);
        await interaction.editReply(
          `🚀 **Bump Reminder Configured:** Alerts will be sent to <#${channel.id}> every 2 hours.`,
        );
        return;
      }

      if (sub === 'disable') {
        await service.disableBumpReminder(guild.id);
        await interaction.editReply('Bump reminders disabled.');
        return;
      }

      if (sub === 'view') {
        const cfg = await service.getBumpReminder(guild.id);
        if (!cfg) {
          await interaction.editReply('No bump reminder configured.');
          return;
        }
        const embed = new EmbedBuilder()
          .setTitle('🚀 Bump Reminder Settings')
          .setColor(0x6366f1)
          .addFields(
            { name: 'Channel', value: `<#${cfg.channelId}>`, inline: true },
            {
              name: 'Next Reminder',
              value: `<t:${Math.floor(cfg.remindAt.getTime() / 1000)}:R>`,
              inline: true,
            },
          );
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (sub === 'bump') {
        await interaction.editReply('🚀 Bump recorded! Next reminder in 2 hours.');
      }
    },
  };

  // 10. /social
  const socialCommand: CommandDefinition = {
    name: 'social',
    description: 'Set up automated live stream and social post alerts (Twitch, YouTube, Reddit).',
    data: new SlashCommandBuilder()
      .setName('social')
      .setDescription(
        'Set up automated live stream and social post alerts (Twitch, YouTube, Reddit).',
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addSubcommand((sub) =>
        sub
          .setName('add')
          .setDescription('Add a social alert feed')
          .addStringOption((opt) =>
            opt
              .setName('platform')
              .setDescription('Platform')
              .setRequired(true)
              .addChoices(
                { name: 'Twitch', value: 'twitch' },
                { name: 'YouTube', value: 'youtube' },
                { name: 'Reddit', value: 'reddit' },
              ),
          )
          .addStringOption((opt) =>
            opt
              .setName('handle')
              .setDescription('Channel name / username / subreddit')
              .setRequired(true),
          )
          .addChannelOption((opt) =>
            opt
              .setName('channel')
              .setDescription('Notification channel')
              .addChannelTypes(ChannelType.GuildText)
              .setRequired(true),
          )
          .addStringOption((opt) =>
            opt.setName('custom_message').setDescription('Custom announcement message'),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName('remove')
          .setDescription('Remove a social alert')
          .addStringOption((opt) =>
            opt
              .setName('platform')
              .setDescription('Platform')
              .setRequired(true)
              .addChoices(
                { name: 'Twitch', value: 'twitch' },
                { name: 'YouTube', value: 'youtube' },
                { name: 'Reddit', value: 'reddit' },
              ),
          )
          .addStringOption((opt) =>
            opt.setName('handle').setDescription('Handle to remove').setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub.setName('list').setDescription('List active social notifications'),
      ),
    guildOnly: true,
    defaultMemberPermissions: PermissionFlagsBits.ManageGuild,
    execute: async (interaction: ChatInputCommandInteraction) => {
      await interaction.deferReply({ ephemeral: true });
      const guild = interaction.guild;
      if (!guild) {
        await interaction.editReply('Must be run in a server.');
        return;
      }

      const sub = interaction.options.getSubcommand();

      if (sub === 'add') {
        const platform = interaction.options.getString('platform', true);
        const handle = interaction.options.getString('handle', true);
        const channel = interaction.options.getChannel<ChannelType.GuildText>('channel', true);

        await service.addSocialAlert(guild.id, platform, handle, channel.id);
        await interaction.editReply(
          `🔔 **Social Alert Configured:** **${platform}** updates for **${handle}** will post to <#${channel.id}>.`,
        );
        return;
      }

      if (sub === 'remove') {
        const platform = interaction.options.getString('platform', true);
        const handle = interaction.options.getString('handle', true);
        const ok = await service.removeSocialAlert(guild.id, platform, handle);
        await interaction.editReply(
          ok ? `Removed ${platform} alert for **${handle}**.` : 'Alert not found.',
        );
        return;
      }

      if (sub === 'list') {
        const list = await service.listSocialAlerts(guild.id);
        if (list.length === 0) {
          await interaction.editReply('No social alerts configured.');
          return;
        }
        const embed = new EmbedBuilder()
          .setTitle('🔔 Social Alert Feeds')
          .setColor(0xec4899)
          .setDescription(
            list
              .map((sa) => `• **${sa.platform}**: \`${sa.account}\` -> <#${sa.channelId}>`)
              .join('\n'),
          );
        await interaction.editReply({ embeds: [embed] });
      }
    },
  };

  // 11. /boosterrole
  const boosterroleCommand: CommandDefinition = {
    name: 'boosterrole',
    description: 'Create and customize your exclusive server booster role.',
    data: new SlashCommandBuilder()
      .setName('boosterrole')
      .setDescription('Create and customize your exclusive server booster role.')
      .addSubcommand((sub) =>
        sub
          .setName('create')
          .setDescription('Create your custom booster role')
          .addStringOption((opt) =>
            opt.setName('name').setDescription('Role name').setRequired(true),
          )
          .addStringOption((opt) =>
            opt.setName('color').setDescription('Hex color (e.g. #FF5733)').setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName('color')
          .setDescription('Update your booster role color')
          .addStringOption((opt) =>
            opt.setName('color').setDescription('New hex color').setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName('name')
          .setDescription('Update your booster role name')
          .addStringOption((opt) =>
            opt.setName('name').setDescription('New role name').setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub.setName('delete').setDescription('Delete your booster custom role'),
      ),
    guildOnly: true,
    execute: async (interaction: ChatInputCommandInteraction) => {
      await interaction.deferReply({ ephemeral: true });
      const guild = interaction.guild;
      const member = interaction.member;
      if (!guild || !member || !(member instanceof Object && 'roles' in member)) {
        await interaction.editReply('Must be run in a server.');
        return;
      }

      const guildMember = member as GuildMember;
      if (!guildMember.premiumSince) {
        await interaction.editReply(
          '⭐ You must be actively boosting this server to manage a custom booster role.',
        );
        return;
      }

      const sub = interaction.options.getSubcommand();

      if (sub === 'create') {
        const name = interaction.options.getString('name', true);
        const color = interaction.options.getString('color', true);

        try {
          const roleId = await service.createBoosterRole(guild, guildMember, name, color);
          await interaction.editReply(`⭐ Custom booster role created: <@&${roleId}>!`);
        } catch (err: unknown) {
          await interaction.editReply(
            `Failed to create booster role: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        return;
      }

      if (sub === 'color') {
        const color = interaction.options.getString('color', true);
        const record = await service.getBoosterRole(guild.id, guildMember.id);
        if (!record) {
          await interaction.editReply(
            'You do not have a custom booster role. Use `/boosterrole create`.',
          );
          return;
        }
        const role = guild.roles.cache.get(record.roleId);
        if (role) {
          await role.setColor(color as ColorResolvable);
          await interaction.editReply(`Updated role color to **${color}**.`);
        }
        return;
      }

      if (sub === 'name') {
        const name = interaction.options.getString('name', true);
        const record = await service.getBoosterRole(guild.id, guildMember.id);
        if (!record) {
          await interaction.editReply(
            'You do not have a custom booster role. Use `/boosterrole create`.',
          );
          return;
        }
        const role = guild.roles.cache.get(record.roleId);
        if (role) {
          await role.setName(name);
          await interaction.editReply(`Updated role name to **${name}**.`);
        }
        return;
      }

      if (sub === 'delete') {
        const ok = await service.deleteBoosterRole(guild, guildMember);
        await interaction.editReply(
          ok ? 'Your booster role has been deleted.' : 'No booster role found to delete.',
        );
      }
    },
  };

  return [
    autoroleCommand,
    reactionroleCommand,
    vanityroleCommand,
    clownboardCommand,
    counterCommand,
    autoresponderCommand,
    invitesCommand,
    timerCommand,
    bumperCommand,
    socialCommand,
    boosterroleCommand,
  ];
}
