import {
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { CommandDefinition } from '../core/types.js';
import type { PrefixService } from './service.js';

export function createPrefixCommands(service: PrefixService): CommandDefinition[] {
  // 1. /prefix
  const prefixCmd: CommandDefinition = {
    name: 'prefix',
    description: 'Configure server command prefix and manage No-Prefix exemptions.',
    data: new SlashCommandBuilder()
      .setName('prefix')
      .setDescription('Configure server command prefix and manage No-Prefix exemptions.')
      .addSubcommand((sub) =>
        sub
          .setName('set')
          .setDescription('Change the custom command prefix for this server')
          .addStringOption((opt) => opt.setName('symbol').setDescription('Prefix symbol (e.g. !, ?, $, .)').setRequired(true)),
      )
      .addSubcommand((sub) => sub.setName('view').setDescription('Display the active command prefix'))
      .addSubcommandGroup((grp) =>
        grp
          .setName('noprefix')
          .setDescription('Manage users exempted from needing any prefix')
          .addSubcommand((sub) =>
            sub
              .setName('grant')
              .setDescription('Grant no-prefix execution privilege to a user')
              .addUserOption((opt) => opt.setName('user').setDescription('Target user').setRequired(true))
              .addIntegerOption((opt) => opt.setName('days').setDescription('Duration in days (leave blank for permanent)')),
          )
          .addSubcommand((sub) =>
            sub
              .setName('revoke')
              .setDescription('Revoke no-prefix privilege from a user')
              .addUserOption((opt) => opt.setName('user').setDescription('Target user').setRequired(true)),
          )
          .addSubcommand((sub) => sub.setName('list').setDescription('List all members with no-prefix privileges')),
      ),
    guildOnly: true,
    execute: async (interaction: ChatInputCommandInteraction) => {
      const guild = interaction.guild;
      if (!guild) {
        await interaction.reply({ content: 'Must be run in a server.', ephemeral: true });
        return;
      }

      const group = interaction.options.getSubcommandGroup(false);
      const sub = interaction.options.getSubcommand();

      if (group === 'noprefix') {
        // Owner only check
        if (interaction.user.id !== guild.ownerId) {
          await interaction.reply({ content: '❌ Only the Server Owner can manage No-Prefix exemptions.', ephemeral: true });
          return;
        }

        await interaction.deferReply({ ephemeral: true });

        if (sub === 'grant') {
          const target = interaction.options.getUser('user', true);
          const days = interaction.options.getInteger('days');

          await service.grantNoPrefix(target.id, interaction.user.id, days ?? undefined);
          await interaction.editReply(
            `⭐ Granted No-Prefix privileges to <@${target.id}>${days ? ` for ${days} days` : ' permanently'}!`,
          );
          return;
        }

        if (sub === 'revoke') {
          const target = interaction.options.getUser('user', true);
          const ok = await service.revokeNoPrefix(target.id);
          await interaction.editReply(
            ok ? `Revoked No-Prefix privileges from <@${target.id}>.` : 'User does not have an active exemption.',
          );
          return;
        }

        if (sub === 'list') {
          const list = await service.listNoPrefix();
          if (list.length === 0) {
            await interaction.editReply('No users currently possess No-Prefix exemptions.');
            return;
          }
          const embed = new EmbedBuilder()
            .setTitle('⭐ No-Prefix Exemptions')
            .setColor(0xf59e0b)
            .setDescription(
              list
                .map(
                  (np) =>
                    `• <@${np.userId}> (\`${np.userId}\`) — ${np.expiresAt ? `Expires <t:${Math.floor(np.expiresAt.getTime() / 1000)}:R>` : 'Permanent'}`,
                )
                .join('\n'),
            );
          await interaction.editReply({ embeds: [embed] });
          return;
        }
      }

      if (sub === 'set') {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
          await interaction.reply({ content: 'You need Manage Server permissions to change the prefix.', ephemeral: true });
          return;
        }

        const symbol = interaction.options.getString('symbol', true);
        await service.setPrefix(guild.id, symbol);
        await interaction.reply(`✅ Command prefix updated to: \`${symbol}\``);
        return;
      }

      if (sub === 'view') {
        const prefix = await service.getPrefix(guild.id);
        const embed = new EmbedBuilder()
          .setTitle('⚙️ Server Prefix')
          .setColor(0x6366f1)
          .setDescription(
            `Current command prefix: \`${prefix}\`\n\nYou can also trigger commands using:\n• \`?command\`\n• <@${interaction.client.user?.id}> \`command\``,
          );
        await interaction.reply({ embeds: [embed] });
      }
    },
  };

  // 2. /template
  const templateCmd: CommandDefinition = {
    name: 'template',
    description: 'Save, view, and manage complete server layout templates.',
    data: new SlashCommandBuilder()
      .setName('template')
      .setDescription('Save, view, and manage complete server layout templates.')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addSubcommand((sub) =>
        sub
          .setName('save')
          .setDescription('Take a complete snapshot of server channels and roles')
          .addStringOption((opt) => opt.setName('name').setDescription('Template name').setRequired(true)),
      )
      .addSubcommand((sub) =>
        sub
          .setName('view')
          .setDescription('Inspect a saved server template')
          .addStringOption((opt) => opt.setName('name').setDescription('Template name').setRequired(true)),
      )
      .addSubcommand((sub) => sub.setName('list').setDescription('List all saved templates for this server'))
      .addSubcommand((sub) =>
        sub
          .setName('delete')
          .setDescription('Delete a saved template')
          .addStringOption((opt) => opt.setName('name').setDescription('Template name').setRequired(true)),
      ),
    guildOnly: true,
    defaultMemberPermissions: PermissionFlagsBits.Administrator,
    execute: async (interaction: ChatInputCommandInteraction) => {
      await interaction.deferReply({ ephemeral: true });
      const guild = interaction.guild;
      if (!guild) {
        await interaction.editReply('Must be run in a server.');
        return;
      }

      const sub = interaction.options.getSubcommand();

      if (sub === 'save') {
        const name = interaction.options.getString('name', true);
        const id = await service.saveTemplate(guild, name, interaction.user.id);
        await interaction.editReply(`✅ Server template **${name}** saved successfully! (ID: \`${id}\`)`);
        return;
      }

      if (sub === 'view') {
        const name = interaction.options.getString('name', true);
        const tmpl = await service.getTemplate(guild.id, name);
        if (!tmpl) {
          await interaction.editReply(`Template **${name}** not found.`);
          return;
        }

        const data = tmpl.data as { name: string; roles: unknown[]; channels: unknown[] };
        const embed = new EmbedBuilder()
          .setTitle(`📦 Template: ${tmpl.name}`)
          .setColor(0x6366f1)
          .addFields(
            { name: 'Server Name', value: data.name ?? 'Unknown', inline: true },
            { name: 'Roles Saved', value: `${data.roles?.length ?? 0}`, inline: true },
            { name: 'Channels Saved', value: `${data.channels?.length ?? 0}`, inline: true },
            { name: 'Saved At', value: `<t:${Math.floor(tmpl.createdAt.getTime() / 1000)}:R>`, inline: true },
          )
          .setFooter({ text: 'Riffly Template Engine' });

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (sub === 'list') {
        const list = await service.listTemplates(guild.id);
        if (list.length === 0) {
          await interaction.editReply('No saved templates found for this server.');
          return;
        }
        const embed = new EmbedBuilder()
          .setTitle('📦 Saved Server Templates')
          .setColor(0x6366f1)
          .setDescription(list.map((t) => `• **${t.name}** (\`${t.id}\`) — Saved <t:${Math.floor(t.createdAt.getTime() / 1000)}:R>`).join('\n'));
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      if (sub === 'delete') {
        const name = interaction.options.getString('name', true);
        const ok = await service.deleteTemplate(guild.id, name);
        await interaction.editReply(ok ? `Template **${name}** deleted.` : 'Template not found.');
      }
    },
  };

  return [prefixCmd, templateCmd];
}
