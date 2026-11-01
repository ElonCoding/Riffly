import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import type { TextChannel } from 'discord.js';
import type { CommandDefinition } from '../core/types.js';
import type { GiveawayService } from './service.js';

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

export function createGiveawayCommands(service: GiveawayService): CommandDefinition[] {
  const giveawayCommand: CommandDefinition = {
    name: 'giveaway',
    description: 'Host and manage server giveaways.',
    data: new SlashCommandBuilder()
      .setName('giveaway')
      .setDescription('Host and manage server giveaways.')
      .addSubcommand((sub) =>
        sub
          .setName('start')
          .setDescription('Start a new giveaway in the specified channel.')
          .addStringOption((opt) =>
            opt.setName('prize').setDescription('The prize to give away').setRequired(true),
          )
          .addStringOption((opt) =>
            opt.setName('duration').setDescription('Duration (e.g. 10m, 1h, 1d)').setRequired(true),
          )
          .addIntegerOption((opt) =>
            opt
              .setName('winners')
              .setDescription('Number of winners (default: 1)')
              .setMinValue(1)
              .setMaxValue(20)
              .setRequired(false),
          )
          .addChannelOption((opt) =>
            opt
              .setName('channel')
              .setDescription('Channel to host the giveaway in')
              .addChannelTypes(ChannelType.GuildText)
              .setRequired(false),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName('end')
          .setDescription('End an active giveaway immediately.')
          .addStringOption((opt) =>
            opt.setName('message_id').setDescription('Giveaway message ID').setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName('reroll')
          .setDescription('Reroll winner(s) for a concluded giveaway.')
          .addStringOption((opt) =>
            opt.setName('message_id').setDescription('Giveaway message ID').setRequired(true),
          ),
      )
      .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
    guildOnly: true,
    defaultMemberPermissions: PermissionFlagsBits.ManageGuild,
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: true });

      if (!interaction.guildId || !interaction.guild) {
        await interaction.editReply({ content: 'This command can only be used in a server.' });
        return;
      }

      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'start') {
        const prize = interaction.options.getString('prize', true);
        const durationStr = interaction.options.getString('duration', true);
        const winnersCount = interaction.options.getInteger('winners') ?? 1;
        const channelOption = interaction.options.getChannel('channel');
        const targetChannel = (channelOption ?? interaction.channel) as TextChannel | null;

        if (
          !targetChannel ||
          !('send' in targetChannel) ||
          typeof targetChannel.send !== 'function'
        ) {
          await interaction.editReply({ content: '❌ Invalid target channel.' });
          return;
        }

        const durationMs = parseDuration(durationStr);
        if (!durationMs || durationMs < 5000) {
          await interaction.editReply({
            content: '❌ Invalid duration. Minimum duration is 5s (e.g. `10m`, `1h`, `1d`).',
          });
          return;
        }

        try {
          const giveaway = await service.startGiveaway(targetChannel, {
            guildId: interaction.guildId,
            channelId: targetChannel.id,
            prize,
            durationMs,
            winnersCount,
            hostId: interaction.user.id,
          });

          await interaction.editReply({
            content: `✅ Giveaway started in <#${targetChannel.id}>! (Message ID: \`${giveaway.messageId}\`)`,
          });
        } catch (err: unknown) {
          await interaction.editReply({
            content: `❌ Failed to start giveaway: ${err instanceof Error ? err.message : String(err)}`,
          });
        }
      } else if (subcommand === 'end') {
        const messageId = interaction.options.getString('message_id', true);
        const result = await service.endGiveaway(messageId);
        if (!result) {
          await interaction.editReply({
            content: '❌ Giveaway not found or already ended.',
          });
          return;
        }

        await interaction.editReply({
          content: `✅ Giveaway ended! Winners: ${result.winners.length > 0 ? result.winners.map((w) => `<@${w}>`).join(', ') : 'None'}.`,
        });
      } else if (subcommand === 'reroll') {
        const messageId = interaction.options.getString('message_id', true);
        const winners = await service.rerollGiveaway(messageId);
        if (winners.length === 0) {
          await interaction.editReply({
            content: '❌ Could not reroll giveaway (not found, still active, or no participants).',
          });
          return;
        }

        await interaction.editReply({
          content: `✅ Rerolled! New winner(s): ${winners.map((w) => `<@${w}>`).join(', ')}.`,
        });
      }
    },
  };

  return [giveawayCommand];
}
