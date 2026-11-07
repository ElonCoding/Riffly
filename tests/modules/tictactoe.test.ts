import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ButtonInteraction, ChatInputCommandInteraction } from 'discord.js';
import {
  checkWinner,
  getBestBotMove,
  buildTicTacToeRows,
  buildTicTacToeEmbed,
  createTicTacToeGame,
  getTicTacToeGame,
  clearTicTacToeGame,
  handleTicTacToeButton,
  type TicTacToeGame,
} from '../../src/modules/fun/tictactoe.js';
import { createFunCommands } from '../../src/modules/fun/commands.js';

describe('Tic-Tac-Toe Game Engine Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('checkWinner logic', () => {
    it('detects row win', () => {
      const board: Array<'X' | 'O' | null> = ['X', 'X', 'X', null, null, null, null, null, null];
      expect(checkWinner(board)).toBe('X');
    });

    it('detects column win', () => {
      const board: Array<'X' | 'O' | null> = ['O', null, null, 'O', null, null, 'O', null, null];
      expect(checkWinner(board)).toBe('O');
    });

    it('detects diagonal win', () => {
      const board: Array<'X' | 'O' | null> = ['X', null, null, null, 'X', null, null, null, 'X'];
      expect(checkWinner(board)).toBe('X');
    });

    it('detects tie/draw when board full', () => {
      const board: Array<'X' | 'O' | null> = [
        'X', 'O', 'X',
        'X', 'O', 'O',
        'O', 'X', 'X',
      ];
      expect(checkWinner(board)).toBe('draw');
    });

    it('returns null when game still in progress', () => {
      const board: Array<'X' | 'O' | null> = ['X', 'O', null, null, null, null, null, null, null];
      expect(checkWinner(board)).toBeNull();
    });
  });

  describe('Bot AI Move Calculator', () => {
    it('takes winning move if available', () => {
      const board: Array<'X' | 'O' | null> = ['O', 'O', null, 'X', 'X', null, null, null, null];
      expect(getBestBotMove(board)).toBe(2);
    });

    it('blocks opponent from winning', () => {
      const board: Array<'X' | 'O' | null> = ['X', 'X', null, 'O', null, null, null, null, null];
      expect(getBestBotMove(board)).toBe(2);
    });

    it('takes center if empty', () => {
      const board: Array<'X' | 'O' | null> = ['X', null, null, null, null, null, null, null, null];
      expect(getBestBotMove(board)).toBe(4);
    });

    it('builds component rows and embeds', () => {
      const board: Array<'X' | 'O' | null> = ['X', 'O', null, null, null, null, null, null, null];
      const rows = buildTicTacToeRows(board);
      expect(rows).toHaveLength(3);
      expect(rows[0]?.components).toHaveLength(3);

      const game: TicTacToeGame = {
        messageId: 'test-1',
        guildId: 'g1',
        playerX: { id: 'x1', username: 'XUser' },
        playerO: { id: 'o1', username: 'OUser', isBot: false },
        board,
        turn: 'X',
        winner: 'X',
        lastUpdated: Date.now(),
      };
      const embed = buildTicTacToeEmbed(game);
      expect(embed.data.title).toContain('Winner');
    });

    it('manages game lifecycle in memory', () => {
      const game: TicTacToeGame = {
        messageId: 'test-clear',
        guildId: 'g1',
        playerX: { id: 'x1', username: 'XUser' },
        playerO: { id: 'o1', username: 'OUser', isBot: false },
        board: Array(9).fill(null),
        turn: 'X',
        winner: null,
        lastUpdated: Date.now(),
      };
      createTicTacToeGame(game);
      expect(getTicTacToeGame('test-clear')).toBeDefined();
      expect(clearTicTacToeGame('test-clear')).toBe(true);
      expect(getTicTacToeGame('test-clear')).toBeUndefined();
    });
  });

  describe('Interactive Button Handlers', () => {
    const sampleGame: TicTacToeGame = {
      messageId: 'msg-ttt-1',
      guildId: 'guild-1',
      playerX: { id: 'p1', username: 'PlayerOne' },
      playerO: { id: 'p2', username: 'PlayerTwo', isBot: false },
      board: Array(9).fill(null),
      turn: 'X',
      winner: null,
      lastUpdated: Date.now(),
    };

    it('rejects spectators not in the game', async () => {
      createTicTacToeGame({ ...sampleGame, board: Array(9).fill(null) });

      const replySpy = vi.fn().mockResolvedValue(true);
      const interaction = {
        customId: 'riffly_ttt_0',
        message: { id: 'msg-ttt-1' },
        user: { id: 'spectator_user' },
        reply: replySpy,
      } as unknown as ButtonInteraction;

      await handleTicTacToeButton(interaction);

      expect(replySpy).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('not a player') }),
      );
    });

    it('rejects move when not players turn', async () => {
      createTicTacToeGame({ ...sampleGame, board: Array(9).fill(null), turn: 'X' });

      const replySpy = vi.fn().mockResolvedValue(true);
      const interaction = {
        customId: 'riffly_ttt_0',
        message: { id: 'msg-ttt-1' },
        user: { id: 'p2' }, // Player O attempting to play during X's turn
        reply: replySpy,
      } as unknown as ButtonInteraction;

      await handleTicTacToeButton(interaction);

      expect(replySpy).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('not your turn') }),
      );
    });

    it('places mark and switches turn on valid move', async () => {
      createTicTacToeGame({ ...sampleGame, board: Array(9).fill(null), turn: 'X' });

      const updateSpy = vi.fn().mockResolvedValue(true);
      const interaction = {
        customId: 'riffly_ttt_4', // Center
        message: { id: 'msg-ttt-1' },
        user: { id: 'p1' },
        update: updateSpy,
      } as unknown as ButtonInteraction;

      await handleTicTacToeButton(interaction);

      const game = getTicTacToeGame('msg-ttt-1');
      expect(game?.board[4]).toBe('X');
      expect(game?.turn).toBe('O');
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ embeds: expect.any(Array), components: expect.any(Array) }),
      );
    });

    it('triggers instant AI countermove when opponent is bot', async () => {
      createTicTacToeGame({
        ...sampleGame,
        messageId: 'msg-ttt-bot',
        playerO: { id: 'bot-id', username: 'Riffly', isBot: true },
        board: Array(9).fill(null),
        turn: 'X',
      });

      const updateSpy = vi.fn().mockResolvedValue(true);
      const interaction = {
        customId: 'riffly_ttt_0',
        message: { id: 'msg-ttt-bot' },
        user: { id: 'p1' },
        update: updateSpy,
      } as unknown as ButtonInteraction;

      await handleTicTacToeButton(interaction);

      const game = getTicTacToeGame('msg-ttt-bot');
      expect(game?.board[0]).toBe('X');
      // Bot took a move in one of the other cells!
      const oCount = game?.board.filter((c) => c === 'O').length;
      expect(oCount).toBe(1);
      // Turn switched back to player X
      expect(game?.turn).toBe('X');
    });
  });

  describe('/tictactoe slash command', () => {
    it('executes /tictactoe and spawns interactive game board', async () => {
      const funCommands = createFunCommands();
      const ttt = funCommands.find((c) => c.name === 'tictactoe')!;
      expect(ttt).toBeDefined();

      const replySpy = vi.fn().mockResolvedValue({ id: 'new-msg-123' });
      const interaction = {
        options: {
          getUser: vi.fn().mockReturnValue({ id: 'p2', username: 'Friend', bot: false }),
        },
        user: { id: 'p1', username: 'Host' },
        guildId: 'guild-1',
        reply: replySpy,
      } as unknown as ChatInputCommandInteraction;

      await ttt.execute(interaction);

      expect(replySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array),
          components: expect.any(Array),
          fetchReply: true,
        }),
      );

      const game = getTicTacToeGame('new-msg-123');
      expect(game).toBeDefined();
      expect(game?.playerX.id).toBe('p1');
      expect(game?.playerO.id).toBe('p2');
    });

    it('rejects playing against self', async () => {
      const funCommands = createFunCommands();
      const ttt = funCommands.find((c) => c.name === 'tictactoe')!;

      const replySpy = vi.fn().mockResolvedValue(true);
      const interaction = {
        options: {
          getUser: vi.fn().mockReturnValue({ id: 'p1', username: 'Host', bot: false }),
        },
        user: { id: 'p1', username: 'Host' },
        guildId: 'guild-1',
        reply: replySpy,
      } as unknown as ChatInputCommandInteraction;

      await ttt.execute(interaction);

      expect(replySpy).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('cannot play against yourself') }),
      );
    });
  });
});
