import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ButtonInteraction,
} from 'discord.js';

export interface TicTacToeGame {
  messageId: string;
  guildId: string;
  playerX: { id: string; username: string };
  playerO: { id: string; username: string; isBot: boolean };
  board: Array<'X' | 'O' | null>;
  turn: 'X' | 'O';
  winner: 'X' | 'O' | 'draw' | null;
  lastUpdated: number;
}

// In-memory active game state storage
const games = new Map<string, TicTacToeGame>();

// Periodic cleanup of stale games older than 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, game] of games.entries()) {
    if (now - game.lastUpdated > 900000) {
      games.delete(id);
    }
  }
}, 60000);

export const WIN_PATTERNS = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const;

export function checkWinner(board: Array<'X' | 'O' | null>): 'X' | 'O' | 'draw' | null {
  for (const [a, b, c] of WIN_PATTERNS) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  if (board.every((cell) => cell !== null)) {
    return 'draw';
  }
  return null;
}

export function getBestBotMove(board: Array<'X' | 'O' | null>): number {
  // 1. Can bot (O) win in 1 move?
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) {
      board[i] = 'O';
      if (checkWinner(board) === 'O') {
        board[i] = null;
        return i;
      }
      board[i] = null;
    }
  }

  // 2. Can player (X) win in 1 move? Block it!
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) {
      board[i] = 'X';
      if (checkWinner(board) === 'X') {
        board[i] = null;
        return i;
      }
      board[i] = null;
    }
  }

  // 3. Take center (4)
  if (board[4] === null) return 4;

  // 4. Take available corners (0, 2, 6, 8)
  const corners = [0, 2, 6, 8].filter((i) => board[i] === null);
  if (corners.length > 0) {
    return corners[Math.floor(Math.random() * corners.length)]!;
  }

  // 5. Take any remaining empty cell
  const empty = board.map((v, i) => (v === null ? i : -1)).filter((i) => i !== -1);
  return empty.length > 0 ? empty[Math.floor(Math.random() * empty.length)]! : -1;
}

export function buildTicTacToeRows(
  board: Array<'X' | 'O' | null>,
  gameOver = false,
): ActionRowBuilder<ButtonBuilder>[] {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let r = 0; r < 3; r++) {
    const row = new ActionRowBuilder<ButtonBuilder>();
    for (let c = 0; c < 3; c++) {
      const idx = r * 3 + c;
      const cell = board[idx];
      const btn = new ButtonBuilder().setCustomId(`riffly_ttt_${idx}`);

      if (cell === 'X') {
        btn.setLabel('❌').setStyle(ButtonStyle.Danger).setDisabled(true);
      } else if (cell === 'O') {
        btn.setLabel('⭕').setStyle(ButtonStyle.Success).setDisabled(true);
      } else {
        btn.setLabel('➖').setStyle(ButtonStyle.Secondary).setDisabled(gameOver);
      }
      row.addComponents(btn);
    }
    rows.push(row);
  }
  return rows;
}

export function buildTicTacToeEmbed(game: TicTacToeGame): EmbedBuilder {
  const embed = new EmbedBuilder();
  if (game.winner === 'X') {
    embed
      .setTitle('🏆 Tic-Tac-Toe — Winner!')
      .setColor(0x10b981)
      .setDescription(
        `🎉 **${game.playerX.username}** (❌) won against **${game.playerO.username}** (⭕)!`,
      );
  } else if (game.winner === 'O') {
    embed
      .setTitle('🏆 Tic-Tac-Toe — Winner!')
      .setColor(0x10b981)
      .setDescription(
        `🎉 **${game.playerO.username}** (⭕) won against **${game.playerX.username}** (❌)!`,
      );
  } else if (game.winner === 'draw') {
    embed
      .setTitle('🤝 Tic-Tac-Toe — Tie Game!')
      .setColor(0x6b7280)
      .setDescription(
        `It's a draw between **${game.playerX.username}** (❌) and **${game.playerO.username}** (⭕)!`,
      );
  } else {
    const currentTurnUser = game.turn === 'X' ? game.playerX : game.playerO;
    const currentSymbol = game.turn === 'X' ? '❌' : '⭕';
    embed
      .setTitle('🎮 Tic-Tac-Toe Match')
      .setColor(0x3b82f6)
      .setDescription(
        `**${game.playerX.username}** (❌) vs **${game.playerO.username}** (⭕)\n\n` +
          `👉 Turn: <@${currentTurnUser.id}> (${currentSymbol})`,
      );
  }
  embed.setFooter({ text: 'Riffly Fun & Games' }).setTimestamp();
  return embed;
}

export function createTicTacToeGame(game: TicTacToeGame): void {
  games.set(game.messageId, game);
}

export function getTicTacToeGame(messageId: string): TicTacToeGame | undefined {
  return games.get(messageId);
}

export function clearTicTacToeGame(messageId: string): boolean {
  return games.delete(messageId);
}

export async function handleTicTacToeButton(interaction: ButtonInteraction): Promise<void> {
  const customId = interaction.customId;
  const match = customId.match(/^(?:riffly_)?ttt_(\d)$/);
  if (!match) return;

  const cellIndex = Number.parseInt(match[1]!, 10);
  const messageId = interaction.message.id;
  const game = games.get(messageId);

  if (!game) {
    await interaction.reply({
      content: '❌ This Tic-Tac-Toe match has expired or ended. Start a new game with `/tictactoe`.',
      ephemeral: true,
    });
    return;
  }

  if (game.winner) {
    await interaction.reply({
      content: 'ℹ️ This game has already concluded.',
      ephemeral: true,
    });
    return;
  }

  const userId = interaction.user.id;
  const isPlayerX = userId === game.playerX.id;
  const isPlayerO = userId === game.playerO.id;

  if (!isPlayerX && !isPlayerO) {
    await interaction.reply({
      content: '⚠️ You are not a player in this game!',
      ephemeral: true,
    });
    return;
  }

  if ((game.turn === 'X' && !isPlayerX) || (game.turn === 'O' && !isPlayerO)) {
    await interaction.reply({
      content: '⏳ It is not your turn yet!',
      ephemeral: true,
    });
    return;
  }

  if (game.board[cellIndex] !== null) {
    await interaction.reply({
      content: '⚠️ That spot is already taken!',
      ephemeral: true,
    });
    return;
  }

  // Place current player's mark
  game.board[cellIndex] = game.turn;
  game.winner = checkWinner(game.board);

  if (!game.winner) {
    // Switch turn
    game.turn = game.turn === 'X' ? 'O' : 'X';

    // If opponent is a bot, make instant AI move
    if (game.turn === 'O' && game.playerO.isBot) {
      const botMove = getBestBotMove(game.board);
      if (botMove !== -1 && game.board[botMove] === null) {
        game.board[botMove] = 'O';
        game.winner = checkWinner(game.board);
        if (!game.winner) {
          game.turn = 'X';
        }
      }
    }
  }

  game.lastUpdated = Date.now();
  const embed = buildTicTacToeEmbed(game);
  const rows = buildTicTacToeRows(game.board, !!game.winner);

  await interaction.update({
    embeds: [embed],
    components: rows,
  });

  if (game.winner) {
    setTimeout(() => games.delete(messageId), 300000);
  }
}

