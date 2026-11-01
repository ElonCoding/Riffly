import {
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { CommandDefinition } from '../core/types.js';
import type { SecurityService } from './service.js';

export function createSecurityCommands(service: SecurityService): CommandDefinition[] {
  // 1. ANTINUKE COMMAND
  const antinukeCommand: CommandDefinition = {
    name: 'antinuke',
    description: 'Configure and monitor Riffly Anti-Nuke protection.',
    data: new SlashCommandBuilder()
      .setName('antinuke')
      .setDescription('Configure and monitor Riffly Anti-Nuke protection.')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addSubcommand((sub) => sub.setName('enable').setDescription('Enable Anti-Nuke server defense'))
      .addSubcommand((sub) => sub.setName('disable').setDescription('Disable Anti-Nuke server defense'))
      .addSubcommand((sub) =>
        sub
          .setName('config')
          .setDescription('Configure threshold limits and enforcement action')
          .addIntegerOption((opt) => opt.setName('ban_limit').setDescription('Max bans within 10s').setMinValue(1).setMaxValue(20))
          .addIntegerOption((opt) => opt.setName('kick_limit').setDescription('Max kicks within 10s').setMinValue(1).setMaxValue(20))
          .addIntegerOption((opt) => opt.setName('channel_delete_limit').setDescription('Max channel deletions within 10s').setMinValue(1).setMaxValue(20))
          .addStringOption((opt) =>
            opt
              .setName('action')
              .setDescription('Action taken when threshold is violated')
              .addChoices(
                { name: 'Ban executor', value: 'ban' },
                { name: 'Kick executor', value: 'kick' },
                { name: 'Strip roles', value: 'strip_roles' },
              ),
          ),
      )
      .addSubcommandGroup((grp) =>
        grp
          .setName('whitelist')
          .setDescription('Manage Anti-Nuke exemptions')
          .addSubcommand((sub) =>
            sub
              .setName('add')
              .setDescription('Whitelist a trusted staff member or bot')
              .addUserOption((opt) => opt.setName('user').setDescription('User to whitelist').setRequired(true)),
          )
          .addSubcommand((sub) =>
            sub
              .setName('remove')
              .setDescription('Remove a user from the whitelist')
              .addUserOption((opt) => opt.setName('user').setDescription('User to remove').setRequired(true)),
          )
          .addSubcommand((sub) => sub.setName('list').setDescription('List all whitelisted users')),
      )
      .addSubcommand((sub) => sub.setName('view').setDescription('View current Anti-Nuke settings')),
    guildOnly: true,
    defaultMemberPermissions: PermissionFlagsBits.Administrator,
    execute: async (interaction: ChatInputCommandInteraction) => {
      const guild = interaction.guild;
      if (!guild) {
        await interaction.reply({ content: 'Must be run in a server.', ephemeral: true });
        return;
      }

      await interaction.deferReply({ ephemeral: true });
      const group = interaction.options.getSubcommandGroup(false);
      const sub = interaction.options.getSubcommand();

      if (group === 'whitelist') {
        if (sub === 'add') {
          const user = interaction.options.getUser('user', true);
          const list = await service.addNukeWhitelist(guild.id, user.id);
          await interaction.editReply(`✅ Whitelisted <@${user.id}> from Anti-Nuke defense (${list.length} total).`);
          return;
        }
        if (sub === 'remove') {
          const user = interaction.options.getUser('user', true);
          const list = await service.removeNukeWhitelist(guild.id, user.id);
          await interaction.editReply(`Removed <@${user.id}> from Anti-Nuke whitelist (${list.length} remaining).`);
          return;
        }
        if (sub === 'list') {
          const cfg = await service.getAntiNuke(guild.id);
          const desc = cfg.whitelist.length > 0 ? cfg.whitelist.map((id) => `• <@${id}> (\`${id}\`)`).join('\n') : 'No users whitelisted.';
          const embed = new EmbedBuilder()
            .setTitle('🛡️ Anti-Nuke Whitelist')
            .setColor(0x5865f2)
            .setDescription(desc);
          await interaction.editReply({ embeds: [embed] });
          return;
        }
      }

      if (sub === 'enable') {
        await service.setAntiNuke(guild.id, { enabled: true });
        await interaction.editReply('🛡️ **Anti-Nuke protection enabled.** Rogue moderator actions will be blocked.');
        return;
      }

      if (sub === 'disable') {
        await service.setAntiNuke(guild.id, { enabled: false });
        await interaction.editReply('⚠️ **Anti-Nuke protection disabled.**');
        return;
      }

      if (sub === 'config') {
        const banLimit = interaction.options.getInteger('ban_limit');
        const kickLimit = interaction.options.getInteger('kick_limit');
        const chanLimit = interaction.options.getInteger('channel_delete_limit');
        const action = interaction.options.getString('action') as 'ban' | 'kick' | 'strip_roles' | null;

        await service.setAntiNuke(guild.id, {
          ...(banLimit !== null ? { banThreshold: banLimit } : {}),
          ...(kickLimit !== null ? { kickThreshold: kickLimit } : {}),
          ...(chanLimit !== null ? { channelDeleteThreshold: chanLimit } : {}),
          ...(action !== null ? { action } : {}),
        });

        await interaction.editReply('✅ **Anti-Nuke configuration updated.**');
        return;
      }

      if (sub === 'view') {
        const cfg = await service.getAntiNuke(guild.id);
        const embed = new EmbedBuilder()
          .setTitle('🛡️ Riffly Anti-Nuke Settings')
          .setColor(cfg.enabled ? 0x22c55e : 0xef4444)
          .addFields(
            { name: 'Status', value: cfg.enabled ? '🟢 Enabled' : '🔴 Disabled', inline: true },
            { name: 'Punishment', value: `\`${cfg.action}\``, inline: true },
            { name: 'Ban Threshold', value: `${cfg.banThreshold} / 10s`, inline: true },
            { name: 'Kick Threshold', value: `${cfg.kickThreshold} / 10s`, inline: true },
            { name: 'Channel Delete Threshold', value: `${cfg.channelDeleteThreshold} / 10s`, inline: true },
            { name: 'Whitelisted Users', value: `${cfg.whitelist.length} user(s)`, inline: true },
          )
          .setFooter({ text: 'Riffly Security Engine' });
        await interaction.editReply({ embeds: [embed] });
      }
    },
  };

  // 2. ANTIRAID COMMAND
  const antiraidCommand: CommandDefinition = {
    name: 'antiraid',
    description: 'Configure and trigger server raid protection and mass lockouts.',
    data: new SlashCommandBuilder()
      .setName('antiraid')
      .setDescription('Configure and trigger server raid protection and mass lockouts.')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addSubcommand((sub) => sub.setName('enable').setDescription('Enable Anti-Raid join monitoring'))
      .addSubcommand((sub) => sub.setName('disable').setDescription('Disable Anti-Raid join monitoring'))
      .addSubcommand((sub) =>
        sub
          .setName('config')
          .setDescription('Configure raid thresholds and automated response')
          .addIntegerOption((opt) => opt.setName('join_threshold').setDescription('Max joins to trigger raid alarm').setMinValue(3).setMaxValue(50))
          .addIntegerOption((opt) => opt.setName('window_seconds').setDescription('Sliding detection window in seconds').setMinValue(3).setMaxValue(60))
          .addStringOption((opt) =>
            opt
              .setName('action')
              .setDescription('Sanction applied to raiders')
              .addChoices(
                { name: 'Kick raiders', value: 'kick' },
                { name: 'Ban raiders', value: 'ban' },
                { name: 'Timeout raiders', value: 'timeout' },
              ),
          )
          .addBooleanOption((opt) => opt.setName('auto_lockdown').setDescription('Lock text channels during raid')),
      )
      .addSubcommand((sub) =>
        sub
          .setName('lockdown')
          .setDescription('Instantly lock down all text channels')
          .addStringOption((opt) => opt.setName('reason').setDescription('Reason for lockdown')),
      )
      .addSubcommand((sub) => sub.setName('unlockdown').setDescription('Lift server-wide lockdown'))
      .addSubcommand((sub) => sub.setName('view').setDescription('View Anti-Raid settings')),
    guildOnly: true,
    defaultMemberPermissions: PermissionFlagsBits.Administrator,
    execute: async (interaction: ChatInputCommandInteraction) => {
      const guild = interaction.guild;
      if (!guild) {
        await interaction.reply({ content: 'Must be run in a server.', ephemeral: true });
        return;
      }

      await interaction.deferReply({ ephemeral: true });
      const sub = interaction.options.getSubcommand();

      if (sub === 'enable') {
        await service.setAntiRaid(guild.id, { enabled: true });
        await interaction.editReply('🚨 **Anti-Raid monitoring enabled.**');
        return;
      }

      if (sub === 'disable') {
        await service.setAntiRaid(guild.id, { enabled: false });
        await interaction.editReply('⚠️ **Anti-Raid monitoring disabled.**');
        return;
      }

      if (sub === 'config') {
        const joins = interaction.options.getInteger('join_threshold');
        const window = interaction.options.getInteger('window_seconds');
        const action = interaction.options.getString('action') as 'kick' | 'ban' | 'timeout' | null;
        const autoLock = interaction.options.getBoolean('auto_lockdown');

        await service.setAntiRaid(guild.id, {
          ...(joins !== null ? { joinThreshold: joins } : {}),
          ...(window !== null ? { windowSeconds: window } : {}),
          ...(action !== null ? { action } : {}),
          ...(autoLock !== null ? { autoLockdown: autoLock } : {}),
        });

        await interaction.editReply('✅ **Anti-Raid configuration updated.**');
        return;
      }

      if (sub === 'lockdown') {
        const reason = interaction.options.getString('reason') ?? 'Manual server lockdown';
        const count = await service.lockdown(guild, reason);
        await interaction.editReply(`🔒 **Server Lockdown Activated.** Locked ${count} channel(s).`);
        return;
      }

      if (sub === 'unlockdown') {
        const count = await service.unlockdown(guild);
        await interaction.editReply(`🔓 **Server Lockdown Lifted.** Restored permissions across ${count} channel(s).`);
        return;
      }

      if (sub === 'view') {
        const cfg = await service.getAntiRaid(guild.id);
        const embed = new EmbedBuilder()
          .setTitle('🚨 Riffly Anti-Raid Settings')
          .setColor(cfg.enabled ? 0x22c55e : 0xef4444)
          .addFields(
            { name: 'Status', value: cfg.enabled ? '🟢 Enabled' : '🔴 Disabled', inline: true },
            { name: 'Raid Threshold', value: `${cfg.joinThreshold} joins in ${cfg.windowSeconds}s`, inline: true },
            { name: 'Sanction Action', value: `\`${cfg.action}\``, inline: true },
            { name: 'Auto Lockdown', value: cfg.autoLockdown ? '✅ Yes' : '❌ No', inline: true },
          )
          .setFooter({ text: 'Riffly Security Engine' });
        await interaction.editReply({ embeds: [embed] });
      }
    },
  };

  // 3. AUTOMOD COMMAND
  const automodCommand: CommandDefinition = {
    name: 'automod',
    description: 'Configure and monitor automated message moderation and word filters.',
    data: new SlashCommandBuilder()
      .setName('automod')
      .setDescription('Configure and monitor automated message moderation and word filters.')
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
      .addSubcommand((sub) =>
        sub
          .setName('toggle')
          .setDescription('Toggle an AutoMod filter on or off')
          .addStringOption((opt) =>
            opt
              .setName('filter')
              .setDescription('Filter to toggle')
              .setRequired(true)
              .addChoices(
                { name: 'Anti-Spam (Rate Limit)', value: 'antiSpam' },
                { name: 'Anti-Links (URL Blocker)', value: 'antiLinks' },
                { name: 'Anti-Caps (Excessive Caps)', value: 'antiCaps' },
                { name: 'Anti-Mention (Mass Mentions)', value: 'antiMention' },
              ),
          )
          .addBooleanOption((opt) => opt.setName('enabled').setDescription('State').setRequired(true)),
      )
      .addSubcommandGroup((grp) =>
        grp
          .setName('banned-words')
          .setDescription('Manage blocked words and phrases')
          .addSubcommand((sub) =>
            sub
              .setName('add')
              .setDescription('Add a word or phrase to the blacklist')
              .addStringOption((opt) => opt.setName('word').setDescription('Word to block').setRequired(true)),
          )
          .addSubcommand((sub) =>
            sub
              .setName('remove')
              .setDescription('Remove a word from the blacklist')
              .addStringOption((opt) => opt.setName('word').setDescription('Word to remove').setRequired(true)),
          )
          .addSubcommand((sub) => sub.setName('list').setDescription('List all prohibited words')),
      )
      .addSubcommand((sub) =>
        sub
          .setName('thresholds')
          .setDescription('Configure numerical trigger limits for filters')
          .addIntegerOption((opt) => opt.setName('caps_percentage').setDescription('Min uppercase percentage').setMinValue(10).setMaxValue(100))
          .addIntegerOption((opt) => opt.setName('max_mentions').setDescription('Max mentions allowed per message').setMinValue(1).setMaxValue(50))
          .addIntegerOption((opt) => opt.setName('max_messages').setDescription('Max messages per 5s window').setMinValue(2).setMaxValue(20)),
      )
      .addSubcommandGroup((grp) =>
        grp
          .setName('whitelist')
          .setDescription('Exempt channels or roles from AutoMod filters')
          .addSubcommand((sub) =>
            sub
              .setName('add')
              .setDescription('Whitelist a channel or role')
              .addChannelOption((opt) => opt.setName('channel').setDescription('Channel to exempt').addChannelTypes(ChannelType.GuildText))
              .addRoleOption((opt) => opt.setName('role').setDescription('Role to exempt')),
          )
          .addSubcommand((sub) =>
            sub
              .setName('remove')
              .setDescription('Remove an exemption')
              .addChannelOption((opt) => opt.setName('channel').setDescription('Channel to remove').addChannelTypes(ChannelType.GuildText))
              .addRoleOption((opt) => opt.setName('role').setDescription('Role to remove')),
          )
          .addSubcommand((sub) => sub.setName('list').setDescription('List exempt channels and roles')),
      )
      .addSubcommand((sub) => sub.setName('view').setDescription('View complete AutoMod configuration')),
    guildOnly: true,
    defaultMemberPermissions: PermissionFlagsBits.ManageGuild,
    execute: async (interaction: ChatInputCommandInteraction) => {
      const guild = interaction.guild;
      if (!guild) {
        await interaction.reply({ content: 'Must be run in a server.', ephemeral: true });
        return;
      }

      await interaction.deferReply({ ephemeral: true });
      const group = interaction.options.getSubcommandGroup(false);
      const sub = interaction.options.getSubcommand();

      if (group === 'banned-words') {
        if (sub === 'add') {
          const word = interaction.options.getString('word', true);
          const list = await service.addBannedWord(guild.id, word);
          await interaction.editReply(`🚫 Added **${word}** to prohibited words blacklist (${list.length} total).`);
          return;
        }
        if (sub === 'remove') {
          const word = interaction.options.getString('word', true);
          const list = await service.removeBannedWord(guild.id, word);
          await interaction.editReply(`Removed **${word}** from prohibited words blacklist (${list.length} remaining).`);
          return;
        }
        if (sub === 'list') {
          const cfg = await service.getAutoMod(guild.id);
          const desc = cfg.bannedWords.length > 0 ? cfg.bannedWords.map((w) => `• \`${w}\``).join('\n') : 'No banned words configured.';
          const embed = new EmbedBuilder()
            .setTitle('🚫 Prohibited Words List')
            .setColor(0xef4444)
            .setDescription(desc);
          await interaction.editReply({ embeds: [embed] });
          return;
        }
      }

      if (group === 'whitelist') {
        if (sub === 'add') {
          const channel = interaction.options.getChannel('channel');
          const role = interaction.options.getRole('role');
          if (!channel && !role) {
            await interaction.editReply('Please specify either a channel or a role to whitelist.');
            return;
          }
          if (channel) {
            await service.addAutoModWhitelist(guild.id, channel.id, 'channel');
          }
          if (role) {
            await service.addAutoModWhitelist(guild.id, role.id, 'role');
          }
          await interaction.editReply('✅ Exemption added to AutoMod whitelist.');
          return;
        }
        if (sub === 'remove') {
          const channel = interaction.options.getChannel('channel');
          const role = interaction.options.getRole('role');
          if (!channel && !role) {
            await interaction.editReply('Please specify either a channel or a role to remove.');
            return;
          }
          if (channel) {
            await service.removeAutoModWhitelist(guild.id, channel.id, 'channel');
          }
          if (role) {
            await service.removeAutoModWhitelist(guild.id, role.id, 'role');
          }
          await interaction.editReply('Exemption removed from AutoMod whitelist.');
          return;
        }
        if (sub === 'list') {
          const cfg = await service.getAutoMod(guild.id);
          const channels = cfg.whitelistedChannels.length > 0 ? cfg.whitelistedChannels.map((id) => `<#${id}>`).join(', ') : 'None';
          const roles = cfg.whitelistedRoles.length > 0 ? cfg.whitelistedRoles.map((id) => `<@&${id}>`).join(', ') : 'None';
          const embed = new EmbedBuilder()
            .setTitle('🛡️ AutoMod Whitelist')
            .setColor(0x5865f2)
            .addFields(
              { name: 'Exempt Channels', value: channels },
              { name: 'Exempt Roles', value: roles },
            );
          await interaction.editReply({ embeds: [embed] });
          return;
        }
      }

      if (sub === 'toggle') {
        const filter = interaction.options.getString('filter', true);
        const enabled = interaction.options.getBoolean('enabled', true);
        await service.setAutoMod(guild.id, { [filter]: enabled });
        await interaction.editReply(`✅ **${filter}** has been ${enabled ? 'enabled' : 'disabled'}.`);
        return;
      }

      if (sub === 'thresholds') {
        const caps = interaction.options.getInteger('caps_percentage');
        const mentions = interaction.options.getInteger('max_mentions');
        const msgs = interaction.options.getInteger('max_messages');

        await service.setAutoMod(guild.id, {
          ...(caps !== null ? { capsPercentage: caps } : {}),
          ...(mentions !== null ? { maxMentions: mentions } : {}),
          ...(msgs !== null ? { maxMessagesPer5s: msgs } : {}),
        });

        await interaction.editReply('✅ **AutoMod thresholds updated.**');
        return;
      }

      if (sub === 'view') {
        const cfg = await service.getAutoMod(guild.id);
        const embed = new EmbedBuilder()
          .setTitle('🛡️ Riffly AutoMod Configuration')
          .setColor(0x3b82f6)
          .addFields(
            { name: 'Anti-Spam (Rate Limit)', value: cfg.antiSpam ? `🟢 Enabled (${cfg.maxMessagesPer5s} msgs / 5s)` : '🔴 Disabled', inline: true },
            { name: 'Anti-Links', value: cfg.antiLinks ? '🟢 Enabled' : '🔴 Disabled', inline: true },
            { name: 'Anti-Caps', value: cfg.antiCaps ? `🟢 Enabled (${cfg.capsPercentage}% limit)` : '🔴 Disabled', inline: true },
            { name: 'Anti-Mention Spam', value: cfg.antiMention ? `🟢 Enabled (Max ${cfg.maxMentions})` : '🔴 Disabled', inline: true },
            { name: 'Banned Words Count', value: `${cfg.bannedWords.length} words`, inline: true },
            { name: 'Whitelisted Exemptions', value: `${cfg.whitelistedChannels.length} channel(s), ${cfg.whitelistedRoles.length} role(s)`, inline: true },
          )
          .setFooter({ text: 'Riffly Security Engine' });
        await interaction.editReply({ embeds: [embed] });
      }
    },
  };

  return [antinukeCommand, antiraidCommand, automodCommand];
}
