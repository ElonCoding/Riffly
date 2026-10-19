import type { Command } from './types.js';
import type { GuildPlayerManager } from '../player/guild-player.js';
import type { TrackResolver } from '../provider/resolver.js';
import { pingCommand } from './ping.js';
import { makeJoinCommand, joinCommandData } from './join.js';
import { makePlayCommand, playCommandData } from './play.js';
import { makePauseCommand, pauseCommandData } from './pause.js';
import { makeResumeCommand, resumeCommandData } from './resume.js';
import { makeSkipCommand, skipCommandData } from './skip.js';
import { makeStopCommand, stopCommandData } from './stop.js';
import { makeLeaveCommand, leaveCommandData } from './leave.js';
import { makeNowPlayingCommand, nowPlayingCommandData } from './nowplaying.js';
import { makeQueueCommand, queueCommandData } from './queue.js';

export * from './types.js';
export * from './ping.js';
export * from './input.js';
export * from './join.js';
export * from './play.js';
export * from './pause.js';
export * from './resume.js';
export * from './skip.js';
export * from './stop.js';
export * from './leave.js';
export * from './nowplaying.js';
export * from './queue.js';

/** Static commands (no dependencies). */
export const staticCommands: readonly Command[] = [pingCommand];

/**
 * Build the full command list with injected dependencies.
 */
export function buildCommands(
  playerManager: GuildPlayerManager,
  resolver: TrackResolver,
): readonly Command[] {
  return [
    pingCommand,
    makeJoinCommand(playerManager),
    makePlayCommand(playerManager, resolver),
    makePauseCommand(playerManager),
    makeResumeCommand(playerManager),
    makeSkipCommand(playerManager),
    makeStopCommand(playerManager),
    makeLeaveCommand(playerManager),
    makeNowPlayingCommand(playerManager),
    makeQueueCommand(playerManager),
  ];
}

export function buildCommandMap(
  playerManager: GuildPlayerManager,
  resolver: TrackResolver,
): ReadonlyMap<string, Command> {
  const cmds = buildCommands(playerManager, resolver);
  return new Map(cmds.map((c) => [c.data.name, c]));
}

/**
 * All real SlashCommandBuilder definitions for registration via Discord REST API.
 */
export const allCommandData: readonly Command['data'][] = [
  pingCommand.data,
  joinCommandData,
  playCommandData,
  pauseCommandData,
  resumeCommandData,
  skipCommandData,
  stopCommandData,
  leaveCommandData,
  nowPlayingCommandData,
  queueCommandData,
];
