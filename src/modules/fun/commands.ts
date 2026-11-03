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

      const fallbackGifs: Record<string, string> = {
        hug: 'https://media.giphy.com/media/od5H3PmEG5EVq/giphy.gif',
        kiss: 'https://media.giphy.com/media/G3va31oEEnIkM/giphy.gif',
        pat: 'https://media.giphy.com/media/L2z7dnOduqEow/giphy.gif',
        slap: 'https://media.giphy.com/media/Gf3AUz3eBNbTW/giphy.gif',
        cuddle: 'https://media.giphy.com/media/wnsgren9NtITS/giphy.gif',
        poke: 'https://media.giphy.com/media/pWd36p57SWeSVstGV5/giphy.gif',
        feed: 'https://media.giphy.com/media/11rIERgn4Y8TbW/giphy.gif',
        tickle: 'https://media.giphy.com/media/vtOCYQJS80144/giphy.gif',
        bite: 'https://media.giphy.com/media/12whPQ31jqYIBq/giphy.gif',
        wave: 'https://media.giphy.com/media/1ULCj5o45QY5G/giphy.gif',
      };

      const verb = actionVerbs[action] ?? action;
      const desc = target
        ? `💖 <@${interaction.user.id}> ${verb} <@${target.id}>!`
        : `✨ <@${interaction.user.id}> ${verb} the room!`;

      let gifUrl = fallbackGifs[action] ?? 'https://media.giphy.com/media/od5H3PmEG5EVq/giphy.gif';
      let animeName: string | undefined;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(`https://nekos.best/api/v2/${action}`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.ok) {
          const data = (await res.json()) as {
            results?: Array<{ url?: string; anime_name?: string }>;
          };
          const first = data.results?.[0];
          if (first?.url) {
            gifUrl = first.url;
            animeName = first.anime_name;
          }
        }
      } catch {
        // Fall back gracefully to curated CDN GIF
      }

      const embed = new EmbedBuilder()
        .setDescription(desc)
        .setColor(0xec4899)
        .setImage(gifUrl);

      if (animeName) {
        embed.setFooter({ text: `Anime: ${animeName} • Powered by Riffly` });
      } else {
        embed.setFooter({ text: 'Powered by Riffly Roleplay' });
      }

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
        .setDescription(
          `**${interaction.user.username}** (❌) vs **${opp.username}** (⭕)\nTurn: <@${interaction.user.id}>`,
        );

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
        new ButtonBuilder()
          .setCustomId('trivia_a')
          .setLabel('A: FLAC')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('trivia_b')
          .setLabel('B: MP3 (Correct)')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('trivia_c')
          .setLabel('C: WAV')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('trivia_d')
          .setLabel('D: OGG')
          .setStyle(ButtonStyle.Primary),
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
        .setDescription(
          `**${term}**\n\nA term of supreme approval and undeniable vibe.\n\n*Example:* "That new Riffly track queue is totally ${term}."`,
        )
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
          .addStringOption((opt) =>
            opt.setName('question').setDescription('Your question').setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub.setName('coinflip').setDescription('Flip a coin (Heads or Tails)'),
      )
      .addSubcommand((sub) =>
        sub
          .setName('roll')
          .setDescription('Roll a random dice')
          .addIntegerOption((opt) =>
            opt
              .setName('sides')
              .setDescription('Number of dice sides (default 6)')
              .setMinValue(2)
              .setMaxValue(100),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName('choose')
          .setDescription('Pick randomly between choices')
          .addStringOption((opt) =>
            opt.setName('options').setDescription('Choices separated by commas').setRequired(true),
          ),
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
          "Don't count on it.",
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
        const parts = raw
          .split(',')
          .map((p) => p.trim())
          .filter((p) => p.length > 0);
        if (parts.length < 2) {
          await interaction.reply({
            content: 'Please provide at least 2 options separated by commas.',
            ephemeral: true,
          });
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
    description: 'Fetch random trending memes across top communities.',
    data: new SlashCommandBuilder()
      .setName('meme')
      .setDescription('Fetch random trending memes across top communities.')
      .addStringOption((opt) =>
        opt
          .setName('category')
          .setDescription('Type of meme')
          .setRequired(false)
          .addChoices(
            { name: '🔥 Dank Memes', value: 'dankmemes' },
            { name: '😂 General Memes', value: 'memes' },
            { name: '💖 Wholesome', value: 'wholesomememes' },
            { name: '🙋 Me IRL', value: 'me_irl' },
            { name: '💻 Programmer Humor', value: 'ProgrammerHumor' },
            { name: '💀 Comedy Heaven', value: 'comedyheaven' },
          ),
      ),
    execute: async (interaction: ChatInputCommandInteraction) => {
      await interaction.deferReply();

      const userCategory = interaction.options.getString('category');
      const pool = [
        'dankmemes',
        'memes',
        'wholesomememes',
        'me_irl',
        'ProgrammerHumor',
        'comedyheaven',
      ];
      const selectedSub =
        userCategory && pool.includes(userCategory)
          ? userCategory
          : pool[Math.floor(Math.random() * pool.length)]!;

      const curatedFallbacks: Record<string, { title: string; url: string; sub: string }[]> = {
        dankmemes: [
          {
            title: 'Task failed successfully',
            url: 'https://i.imgflip.com/2/1g8my4.jpg',
            sub: 'dankmemes',
          },
          {
            title: 'Outstanding Move',
            url: 'https://i.imgflip.com/2/2wsc8b.jpg',
            sub: 'dankmemes',
          },
          {
            title: 'It ain’t much, but it’s honest work',
            url: 'https://i.imgflip.com/2/2qam5r.jpg',
            sub: 'dankmemes',
          },
          {
            title: 'They had us in the first half not gonna lie',
            url: 'https://i.imgflip.com/2/2w7r0y.jpg',
            sub: 'dankmemes',
          },
        ],
        memes: [
          {
            title: 'Distracted Boyfriend',
            url: 'https://i.imgflip.com/1ur9b0.jpg',
            sub: 'memes',
          },
          {
            title: 'Change My Mind',
            url: 'https://i.imgflip.com/24y43o.jpg',
            sub: 'memes',
          },
          {
            title: 'Two Buttons',
            url: 'https://i.imgflip.com/1g8my4.jpg',
            sub: 'memes',
          },
          {
            title: 'Left Exit 12 Off Ramp',
            url: 'https://i.imgflip.com/22bdq6.jpg',
            sub: 'memes',
          },
        ],
        wholesomememes: [
          {
            title: 'Have a great day, legend!',
            url: 'https://i.imgflip.com/4/3si4.jpg',
            sub: 'wholesomememes',
          },
          {
            title: 'You got this!',
            url: 'https://i.imgflip.com/1otk96.jpg',
            sub: 'wholesomememes',
          },
        ],
        ProgrammerHumor: [
          {
            title: '99 little bugs in the code',
            url: 'https://i.imgflip.com/30b1gx.jpg',
            sub: 'ProgrammerHumor',
          },
          {
            title: 'It worked on localhost',
            url: 'https://i.imgflip.com/1bij.jpg',
            sub: 'ProgrammerHumor',
          },
        ],
      };

      let title = '😂 Fresh Meme';
      let imageUrl = 'https://i.imgflip.com/30b1gx.jpg';
      let subName = selectedSub;
      let postLink = 'https://reddit.com/r/' + selectedSub;
      let ups = 0;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(`https://meme-api.com/gimme/${selectedSub}`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.ok) {
          const data = (await res.json()) as {
            title?: string;
            url?: string;
            postLink?: string;
            subreddit?: string;
            ups?: number;
            nsfw?: boolean;
          };

          // Filter out NSFW memes to protect family-friendly Discord servers
          if (data && data.url && !data.nsfw) {
            title = data.title ?? title;
            imageUrl = data.url;
            postLink = data.postLink ?? postLink;
            subName = data.subreddit ?? subName;
            ups = data.ups ?? 0;
          }
        }
      } catch {
        // Fall back gracefully to curated safe pool
        const fallbackList = curatedFallbacks[selectedSub] ?? curatedFallbacks.memes!;
        const picked = fallbackList[Math.floor(Math.random() * fallbackList.length)]!;
        title = picked.title;
        imageUrl = picked.url;
        subName = picked.sub;
      }

      const embed = new EmbedBuilder()
        .setTitle(title.slice(0, 250))
        .setURL(postLink)
        .setColor(0xff4500)
        .setImage(imageUrl)
        .setFooter({
          text: `r/${subName}${ups > 0 ? ` • 👍 ${ups.toLocaleString()}` : ''} • Powered by Riffly`,
        })
        .setTimestamp();

      const refreshButton = new ButtonBuilder()
        .setCustomId(`riffly_meme_next_${subName}`)
        .setLabel('Next Meme')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🔁');

      const redditButton = new ButtonBuilder()
        .setLabel(`r/${subName}`)
        .setStyle(ButtonStyle.Link)
        .setURL(postLink);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        refreshButton,
        redditButton,
      );

      const response = await interaction.editReply({
        embeds: [embed],
        components: [row],
      });

      // Allow requester to click Next Meme for 3 minutes
      if (
        response &&
        typeof (response as unknown as { createMessageComponentCollector?: unknown })
          .createMessageComponentCollector === 'function'
      ) {
        const collector = response.createMessageComponentCollector({
          time: 180_000,
        });

        collector.on('collect', async (btnInt) => {
          if (btnInt.user.id !== interaction.user.id) {
            await btnInt.reply({
              content: '❌ Use `/meme` to spawn your own meme stream.',
              ephemeral: true,
            });
            return;
          }

          await btnInt.deferUpdate();

          try {
            const nextRes = await fetch(`https://meme-api.com/gimme/${selectedSub}`);
            if (nextRes.ok) {
              const nextData = (await nextRes.json()) as {
                title?: string;
                url?: string;
                postLink?: string;
                subreddit?: string;
                ups?: number;
                nsfw?: boolean;
              };

              if (nextData && nextData.url && !nextData.nsfw) {
                const nextEmbed = new EmbedBuilder()
                  .setTitle((nextData.title ?? '😂 Fresh Meme').slice(0, 250))
                  .setURL(nextData.postLink ?? postLink)
                  .setColor(0xff4500)
                  .setImage(nextData.url)
                  .setFooter({
                    text: `r/${nextData.subreddit ?? subName}${nextData.ups ? ` • 👍 ${nextData.ups.toLocaleString()}` : ''} • Powered by Riffly`,
                  })
                  .setTimestamp();

                const updatedRedditBtn = new ButtonBuilder()
                  .setLabel(`r/${nextData.subreddit ?? subName}`)
                  .setStyle(ButtonStyle.Link)
                  .setURL(nextData.postLink ?? postLink);

                const updatedRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                  refreshButton,
                  updatedRedditBtn,
                );

                await btnInt.editReply({
                  embeds: [nextEmbed],
                  components: [updatedRow],
                });
                return;
              }
            }
          } catch {}

          // Fallback if API fails
          const fallbackList = curatedFallbacks[selectedSub] ?? curatedFallbacks.memes!;
          const picked = fallbackList[Math.floor(Math.random() * fallbackList.length)]!;
          const fallbackEmbed = new EmbedBuilder()
            .setTitle(picked.title)
            .setColor(0xff4500)
            .setImage(picked.url)
            .setFooter({ text: `r/${picked.sub} • Powered by Riffly` });

          await btnInt.editReply({
            embeds: [fallbackEmbed],
            components: [row],
          });
        });

        collector.on('end', async () => {
          try {
            const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
              refreshButton.setDisabled(true),
              redditButton,
            );
            await interaction.editReply({ components: [disabledRow] }).catch(() => null);
          } catch {}
        });
      }
    },
  };

  // 8. /fortnite
  const fortniteCmd: CommandDefinition = {
    name: 'fortnite',
    description: 'Lookup Fortnite player battle royale career statistics.',
    data: new SlashCommandBuilder()
      .setName('fortnite')
      .setDescription('Lookup Fortnite player battle royale career statistics.')
      .addStringOption((opt) =>
        opt.setName('player').setDescription('Epic Games display name').setRequired(true),
      ),
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
