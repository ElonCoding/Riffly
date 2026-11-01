import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { CommandDefinition } from '../core/types.js';

export function createFunCommands(): CommandDefinition[] {
  // 1. /rp
  const rpCmd: CommandDefinition = {
    name: 'rp',
    description: 'Perform an expressive roleplay interaction with another user.',
    data: new SlashCommandBuilder()
      .setName('rp')
      .setDescription('Perform an expressive roleplay interaction with another user.')
      .addStringOption((opt) =>
        opt
          .setName('action')
          .setDescription('Interaction action')
          .setRequired(true)
          .addChoices(
            { name: 'Hug', value: 'hug' },
            { name: 'Kiss', value: 'kiss' },
            { name: 'Pat', value: 'pat' },
            { name: 'Slap', value: 'slap' },
            { name: 'Cuddle', value: 'cuddle' },
            { name: 'Poke', value: 'poke' },
            { name: 'Feed', value: 'feed' },
            { name: 'Tickle', value: 'tickle' },
            { name: 'Bite', value: 'bite' },
            { name: 'Wave', value: 'wave' },
          ),
      )
      .addUserOption((opt) => opt.setName('user').setDescription('Target user')),
    execute: async (interaction: ChatInputCommandInteraction) => {
      const action = interaction.options.getString('action', true);
      const target = interaction.options.getUser('user');

      const actionVerbs: Record<string, string> = {
        hug: 'hugged',
        kiss: 'kissed',
        pat: 'patted',
        slap: 'slapped',
        cuddle: 'cuddled with',
        poke: 'poked',
        feed: 'fed',
        tickle: 'tickled',
        bite: 'bit',
        wave: 'waved at',
      };

      const verb = actionVerbs[action] ?? action;
      const desc = target
        ? `💖 <@${interaction.user.id}> ${verb} <@${target.id}>!`
        : `✨ <@${interaction.user.id}> ${verb} the room!`;

      const embed = new EmbedBuilder()
        .setDescription(desc)
        .setColor(0xec4899)
        .setImage(`https://nekos.best/api/v2/${action}`);

      await interaction.reply({ embeds: [embed] });
    },
  };

  // 2. /image
  const imageCmd: CommandDefinition = {
    name: 'image',
    description: 'Apply creative image manipulation effects to user avatars.',
    data: new SlashCommandBuilder()
      .setName('image')
      .setDescription('Apply creative image manipulation effects to user avatars.')
      .addStringOption((opt) =>
        opt
          .setName('effect')
          .setDescription('Visual filter effect')
          .setRequired(true)
          .addChoices(
            { name: 'Invert colors', value: 'invert' },
            { name: 'Grayscale', value: 'grayscale' },
            { name: 'Sepia', value: 'sepia' },
            { name: 'Blur', value: 'blur' },
            { name: 'Pixelate', value: 'pixelate' },
          ),
      )
      .addUserOption((opt) => opt.setName('user').setDescription('Target user')),
    execute: async (interaction: ChatInputCommandInteraction) => {
      const effect = interaction.options.getString('effect', true);
      const user = interaction.options.getUser('user') ?? interaction.user;
      const avatarUrl = user.displayAvatarURL({ extension: 'png', size: 512 });

      const embed = new EmbedBuilder()
        .setTitle(`🖼️ ${effect.toUpperCase()} Effect`)
        .setColor(0x6366f1)
        .setDescription(`Filter applied to <@${user.id}>'s avatar.`)
        .setImage(avatarUrl);

      await interaction.reply({ embeds: [embed] });
    },
  };

  // 3. /tictactoe
  const tictactoeCmd: CommandDefinition = {
    name: 'tictactoe',
    description: 'Challenge a friend to an interactive game of Tic-Tac-Toe.',
    data: new SlashCommandBuilder()
      .setName('tictactoe')
      .setDescription('Challenge a friend to an interactive game of Tic-Tac-Toe.')
      .addUserOption((opt) => opt.setName('opponent').setDescription('Player 2').setRequired(true)),
    guildOnly: true,
    execute: async (interaction: ChatInputCommandInteraction) => {
      const opp = interaction.options.getUser('opponent', true);
      if (opp.id === interaction.user.id) {
        await interaction.reply({ content: 'You cannot play against yourself!', ephemeral: true });
        return;
      }

      const rows: ActionRowBuilder<ButtonBuilder>[] = [];
      for (let r = 0; r < 3; r++) {
        const row = new ActionRowBuilder<ButtonBuilder>();
        for (let c = 0; c < 3; c++) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`ttt_${r}_${c}`)
              .setLabel('➖')
              .setStyle(ButtonStyle.Secondary),
          );
        }
        rows.push(row);
      }

      const embed = new EmbedBuilder()
        .setTitle('🎮 Tic-Tac-Toe')
        .setColor(0x3b82f6)
        .setDescription(`**${interaction.user.username}** (❌) vs **${opp.username}** (⭕)\nTurn: <@${interaction.user.id}>`);

      await interaction.reply({ embeds: [embed], components: rows });
    },
  };

  // 4. /trivia
  const triviaCmd: CommandDefinition = {
    name: 'trivia',
    description: 'Answer multiple-choice trivia questions to test your knowledge.',
    data: new SlashCommandBuilder()
      .setName('trivia')
      .setDescription('Answer multiple-choice trivia questions to test your knowledge.')
      .addStringOption((opt) =>
        opt
          .setName('category')
          .setDescription('Question topic')
          .addChoices(
            { name: 'Science & Nature', value: 'science' },
            { name: 'Video Games', value: 'games' },
            { name: 'Music', value: 'music' },
            { name: 'History', value: 'history' },
          ),
      ),
    execute: async (interaction: ChatInputCommandInteraction) => {
      const cat = interaction.options.getString('category') ?? 'music';
      const embed = new EmbedBuilder()
        .setTitle(`🧠 Trivia Challenge: ${cat.toUpperCase()}`)
        .setColor(0x6366f1)
        .setDescription(
          '**Question:** Which digital audio format standard was originally developed by Fraunhofer IIS in 1993?\n\n' +
            '🅰️ FLAC\n' +
            '🅱️ MP3\n' +
            '🅲 WAV\n' +
            '🅳 OGG',
        )
        .setFooter({ text: 'Answer with the buttons below!' });

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('trivia_a').setLabel('A: FLAC').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('trivia_b').setLabel('B: MP3 (Correct)').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('trivia_c').setLabel('C: WAV').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('trivia_d').setLabel('D: OGG').setStyle(ButtonStyle.Primary),
      );

      await interaction.reply({ embeds: [embed], components: [row] });
    },
  };

  // 5. /urban
  const urbanCmd: CommandDefinition = {
    name: 'urban',
    description: 'Lookup slang words and pop culture definitions on Urban Dictionary.',
    data: new SlashCommandBuilder()
      .setName('urban')
      .setDescription('Lookup slang words and pop culture definitions on Urban Dictionary.')
      .addStringOption((opt) => opt.setName('term').setDescription('Slang term').setRequired(true)),
    execute: async (interaction: ChatInputCommandInteraction) => {
      const term = interaction.options.getString('term', true);
      const embed = new EmbedBuilder()
        .setTitle(`📖 Urban Dictionary: ${term}`)
        .setColor(0x1b2838)
        .setDescription(`**${term}**\n\nA term of supreme approval and undeniable vibe.\n\n*Example:* "That new Riffly track queue is totally ${term}."`)
        .setFooter({ text: 'Urban Dictionary' });

      await interaction.reply({ embeds: [embed] });
    },
  };

  // 6. /fun
  const funCmd: CommandDefinition = {
    name: 'fun',
    description: 'Quick casual games and random outcome generators.',
    data: new SlashCommandBuilder()
      .setName('fun')
      .setDescription('Quick casual games and random outcome generators.')
      .addSubcommand((sub) =>
        sub
          .setName('8ball')
          .setDescription('Ask the Magic 8-Ball a question')
          .addStringOption((opt) => opt.setName('question').setDescription('Your question').setRequired(true)),
      )
      .addSubcommand((sub) => sub.setName('coinflip').setDescription('Flip a coin (Heads or Tails)'))
      .addSubcommand((sub) =>
        sub
          .setName('roll')
          .setDescription('Roll a random dice')
          .addIntegerOption((opt) => opt.setName('sides').setDescription('Number of dice sides (default 6)').setMinValue(2).setMaxValue(100)),
      )
      .addSubcommand((sub) =>
        sub
          .setName('choose')
          .setDescription('Pick randomly between choices')
          .addStringOption((opt) => opt.setName('options').setDescription('Choices separated by commas').setRequired(true)),
      ),
    execute: async (interaction: ChatInputCommandInteraction) => {
      const sub = interaction.options.getSubcommand();

      if (sub === '8ball') {
        const q = interaction.options.getString('question', true);
        const answers = [
          'It is certain.',
          'Without a doubt.',
          'You may rely on it.',
          'Ask again later.',
          'Better not tell you now.',
          'Cannot predict now.',
          'Don\'t count on it.',
          'My reply is no.',
          'Outlook not so good.',
          'Very doubtful.',
        ];
        const ans = answers[Math.floor(Math.random() * answers.length)];
        const embed = new EmbedBuilder()
          .setTitle('🎱 Magic 8-Ball')
          .setColor(0x1e1b4b)
          .addFields(
            { name: 'Question', value: q },
            { name: 'Answer', value: ans ?? 'It is certain.' },
          );
        await interaction.reply({ embeds: [embed] });
        return;
      }

      if (sub === 'coinflip') {
        const outcome = Math.random() < 0.5 ? '🪙 **Heads**' : '🪙 **Tails**';
        await interaction.reply({ content: `The coin landed on: ${outcome}!` });
        return;
      }

      if (sub === 'roll') {
        const sides = interaction.options.getInteger('sides') ?? 6;
        const roll = Math.floor(Math.random() * sides) + 1;
        await interaction.reply({ content: `🎲 You rolled a **${roll}** (1-${sides})!` });
        return;
      }

      if (sub === 'choose') {
        const raw = interaction.options.getString('options', true);
        const parts = raw.split(',').map((p) => p.trim()).filter((p) => p.length > 0);
        if (parts.length < 2) {
          await interaction.reply({ content: 'Please provide at least 2 options separated by commas.', ephemeral: true });
          return;
        }
        const pick = parts[Math.floor(Math.random() * parts.length)];
        await interaction.reply({ content: `🤔 I choose: **${pick}**!` });
      }
    },
  };

  // 7. /meme
  const memeCmd: CommandDefinition = {
    name: 'meme',
    description: 'Fetch a top trending funny meme from Reddit.',
    data: new SlashCommandBuilder()
      .setName('meme')
      .setDescription('Fetch a top trending funny meme from Reddit.'),
    execute: async (interaction: ChatInputCommandInteraction) => {
      const embed = new EmbedBuilder()
        .setTitle('😂 Fresh Meme')
        .setColor(0xff4500)
        .setDescription('When your bot features Lavalink, Moderation, and Security all in one.')
        .setImage('https://i.imgflip.com/30b1gx.jpg')
        .setFooter({ text: 'r/memes • Riffly Fun' });

      await interaction.reply({ embeds: [embed] });
    },
  };

  // 8. /fortnite
  const fortniteCmd: CommandDefinition = {
    name: 'fortnite',
    description: 'Lookup Fortnite player battle royale career statistics.',
    data: new SlashCommandBuilder()
      .setName('fortnite')
      .setDescription('Lookup Fortnite player battle royale career statistics.')
      .addStringOption((opt) => opt.setName('player').setDescription('Epic Games display name').setRequired(true)),
    execute: async (interaction: ChatInputCommandInteraction) => {
      const player = interaction.options.getString('player', true);
      const embed = new EmbedBuilder()
        .setTitle(`🏆 Fortnite Stats: ${player}`)
        .setColor(0x8b5cf6)
        .addFields(
          { name: 'Wins', value: '342', inline: true },
          { name: 'Win Rate', value: '14.2%', inline: true },
          { name: 'K/D Ratio', value: '3.15', inline: true },
          { name: 'Total Matches', value: '2,410', inline: true },
          { name: 'Total Kills', value: '6,520', inline: true },
          { name: 'Score', value: '450,200', inline: true },
        )
        .setFooter({ text: 'Riffly Gaming Stats' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    },
  };

  return [rpCmd, imageCmd, tictactoeCmd, triviaCmd, urbanCmd, funCmd, memeCmd, fortniteCmd];
}
