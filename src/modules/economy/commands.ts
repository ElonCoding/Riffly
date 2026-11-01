import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { CommandDefinition } from '../core/types.js';
import type { IEconomyRepository } from '../../database/types.js';

export function createEconomyCommands(
  repository: IEconomyRepository,
  currency = '🪙',
): CommandDefinition[] {
  const balanceCmd: CommandDefinition = {
    name: 'balance',
    description: 'Check your wallet and bank balance, or check another member balance.',
    data: new SlashCommandBuilder()
      .setName('balance')
      .setDescription('Check your wallet and bank balance, or check another member balance.')
      .addUserOption((opt) =>
        opt.setName('target').setDescription('User to view balance for').setRequired(false),
      ),
    guildOnly: true,
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: false });

      if (!interaction.guildId) return;
      const targetUser = interaction.options.getUser('target') ?? interaction.user;
      const data = await repository.getEconomy(interaction.guildId, targetUser.id);
      const netWorth = data.wallet + data.bank;

      const embed = new EmbedBuilder()
        .setTitle(`${targetUser.username}'s Financial Balance`)
        .setColor(0x10b981)
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
          { name: 'Wallet', value: `${currency} **${data.wallet.toLocaleString()}**`, inline: true },
          { name: 'Bank', value: `${currency} **${data.bank.toLocaleString()}**`, inline: true },
          { name: 'Net Worth', value: `${currency} **${netWorth.toLocaleString()}**`, inline: true },
        )
        .setFooter({ text: 'Riffly Virtual Economy' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    },
  };

  const dailyCmd: CommandDefinition = {
    name: 'daily',
    description: 'Claim your daily allowance of coins (once every 24 hours).',
    data: new SlashCommandBuilder()
      .setName('daily')
      .setDescription('Claim your daily allowance of coins (once every 24 hours).'),
    guildOnly: true,
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: false });

      if (!interaction.guildId) return;
      const reward = 250n;
      const result = await repository.claimDaily(interaction.guildId, interaction.user.id, reward);

      if (!result.claimed) {
        const nextTime = result.nextClaimAt
          ? `<t:${Math.floor(result.nextClaimAt.getTime() / 1000)}:R>`
          : 'later';
        await interaction.editReply({
          content: `⏳ You have already claimed your daily reward! Return ${nextTime}.`,
        });
        return;
      }

      await interaction.editReply({
        content: `🎉 You claimed your daily reward of ${currency} **${reward}**! New balance: ${currency} **${result.data?.wallet.toLocaleString()}**.`,
      });
    },
  };

  const workCmd: CommandDefinition = {
    name: 'work',
    description: 'Work a shift to earn coins (once every 1 hour).',
    data: new SlashCommandBuilder()
      .setName('work')
      .setDescription('Work a shift to earn coins (once every 1 hour).'),
    guildOnly: true,
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: false });

      if (!interaction.guildId) return;
      const result = await repository.work(interaction.guildId, interaction.user.id, 50n, 150n);

      if (!result.worked) {
        const nextTime = result.nextWorkAt
          ? `<t:${Math.floor(result.nextWorkAt.getTime() / 1000)}:R>`
          : 'later';
        await interaction.editReply({
          content: `⏳ You are exhausted! You can work again ${nextTime}.`,
        });
        return;
      }

      await interaction.editReply({
        content: `💼 You completed your shift and earned ${currency} **${result.reward}**! Wallet balance: ${currency} **${result.data?.wallet.toLocaleString()}**.`,
      });
    },
  };

  const payCmd: CommandDefinition = {
    name: 'pay',
    description: 'Transfer coins from your wallet to another member.',
    data: new SlashCommandBuilder()
      .setName('pay')
      .setDescription('Transfer coins from your wallet to another member.')
      .addUserOption((opt) =>
        opt.setName('target').setDescription('Recipient user').setRequired(true),
      )
      .addIntegerOption((opt) =>
        opt
          .setName('amount')
          .setDescription('Amount of coins to send')
          .setMinValue(1)
          .setRequired(true),
      ),
    guildOnly: true,
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: false });

      if (!interaction.guildId) return;
      const targetUser = interaction.options.getUser('target', true);
      const amountNum = interaction.options.getInteger('amount', true);

      if (targetUser.bot) {
        await interaction.editReply({ content: '❌ You cannot transfer coins to a bot.' });
        return;
      }

      const result = await repository.transfer(
        interaction.guildId,
        interaction.user.id,
        targetUser.id,
        BigInt(amountNum),
      );

      if (!result.success) {
        await interaction.editReply({
          content: `❌ Transfer failed: ${result.error ?? 'Unknown error.'}`,
        });
        return;
      }

      await interaction.editReply({
        content: `💸 Successfully transferred ${currency} **${amountNum.toLocaleString()}** to <@${targetUser.id}>!`,
      });
    },
  };

  const depositCmd: CommandDefinition = {
    name: 'deposit',
    description: 'Deposit coins from your wallet into your bank.',
    data: new SlashCommandBuilder()
      .setName('deposit')
      .setDescription('Deposit coins from your wallet into your bank.')
      .addIntegerOption((opt) =>
        opt
          .setName('amount')
          .setDescription('Amount of coins to deposit')
          .setMinValue(1)
          .setRequired(true),
      ),
    guildOnly: true,
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: true });

      if (!interaction.guildId) return;
      const amountNum = interaction.options.getInteger('amount', true);
      const result = await repository.deposit(
        interaction.guildId,
        interaction.user.id,
        BigInt(amountNum),
      );

      if (!result.success) {
        await interaction.editReply({ content: `❌ ${result.error ?? 'Deposit failed.'}` });
        return;
      }

      await interaction.editReply({
        content: `🏦 Deposited ${currency} **${amountNum.toLocaleString()}** into your bank! Bank balance: ${currency} **${result.data?.bank.toLocaleString()}**.`,
      });
    },
  };

  const withdrawCmd: CommandDefinition = {
    name: 'withdraw',
    description: 'Withdraw coins from your bank into your wallet.',
    data: new SlashCommandBuilder()
      .setName('withdraw')
      .setDescription('Withdraw coins from your bank into your wallet.')
      .addIntegerOption((opt) =>
        opt
          .setName('amount')
          .setDescription('Amount of coins to withdraw')
          .setMinValue(1)
          .setRequired(true),
      ),
    guildOnly: true,
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: true });

      if (!interaction.guildId) return;
      const amountNum = interaction.options.getInteger('amount', true);
      const result = await repository.withdraw(
        interaction.guildId,
        interaction.user.id,
        BigInt(amountNum),
      );

      if (!result.success) {
        await interaction.editReply({ content: `❌ ${result.error ?? 'Withdrawal failed.'}` });
        return;
      }

      await interaction.editReply({
        content: `💵 Withdrew ${currency} **${amountNum.toLocaleString()}** from your bank! Wallet balance: ${currency} **${result.data?.wallet.toLocaleString()}**.`,
      });
    },
  };

  const leaderboardCmd: CommandDefinition = {
    name: 'economy-leaderboard',
    description: 'Displays the wealthiest members in the server.',
    data: new SlashCommandBuilder()
      .setName('economy-leaderboard')
      .setDescription('Displays the wealthiest members in the server.'),
    guildOnly: true,
    execute: async (interaction) => {
      await interaction.deferReply({ ephemeral: false });

      if (!interaction.guildId) return;
      const leaders = await repository.getLeaderboard(interaction.guildId, 10);

      const medals = ['🥇', '🥈', '🥉'];
      const lines = leaders.map((leader, index) => {
        const medal = medals[index] ?? `\`#${index + 1}\``;
        return `${medal} <@${leader.userId}> — ${currency} **${leader.wallet.toLocaleString()}** in wallet (Bank: ${currency} **${leader.bank.toLocaleString()}**)`;
      });

      const embed = new EmbedBuilder()
        .setTitle('💰 Server Wealth Leaderboard')
        .setColor(0xf59e0b)
        .setDescription(lines.length > 0 ? lines.join('\n\n') : '*No economy activity yet.*')
        .setFooter({ text: 'Riffly Virtual Economy' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    },
  };

  return [balanceCmd, dailyCmd, workCmd, payCmd, depositCmd, withdrawCmd, leaderboardCmd];
}
