import type { Command } from './types.js';
import type { GuildPlayerManager } from '../player/guild-player.js';
import type { TrackResolver } from '../provider/resolver.js';
import { pingCommand } from './ping.js';
import { makeJoinCommand } from './join.js';
import { makePlayCommand } from './play.js';
import { makePauseCommand } from './pause.js';
import { makeResumeCommand } from './resume.js';
import { makeSkipCommand } from './skip.js';
import { makeStopCommand } from './stop.js';
import { makeLeaveCommand } from './leave.js';
import { makeNowPlayingCommand } from './nowplaying.js';
import { makeQueueCommand } from './queue.js';
import { makeVolumeCommand } from './volume.js';
import { makeLoopCommand } from './loop.js';
import { makeShuffleCommand } from './shuffle.js';
import { makeSeekCommand } from './seek.js';
import { makeRemoveCommand } from './remove.js';
import { makeClearCommand } from './clear.js';
import { makeFilterCommand } from './filter.js';
import { makeAutoplayCommand } from './autoplay.js';

export * from './types.js';
export * from './helpers.js';
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
export * from './volume.js';
export * from './loop.js';
export * from './shuffle.js';
export * from './seek.js';
export * from './remove.js';
export * from './clear.js';
export * from './filter.js';
export * from './autoplay.js';
export * from './master-registry.js';

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
    makeVolumeCommand(playerManager),
    makeLoopCommand(playerManager),
    makeShuffleCommand(playerManager),
    makeSeekCommand(playerManager),
    makeRemoveCommand(playerManager),
    makeClearCommand(playerManager),
    makeFilterCommand(playerManager),
    makeAutoplayCommand(playerManager),
  ];
}

export function buildCommandMap(
  playerManager: GuildPlayerManager,
  resolver: TrackResolver,
): ReadonlyMap<string, Command> {
  const cmds = buildCommands(playerManager, resolver);
  return new Map(cmds.map((c) => [c.data.name, c]));
}

export * from './audio-registry.js';
