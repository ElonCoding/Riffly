import type { Command } from './types.js';
import type { GuildPlayerManager } from '../player/guild-player.js';
import type { TrackResolver } from '../provider/resolver.js';
import { pingCommand } from './ping.js';
import { makePlayCommand } from './play.js';
import { makePauseCommand } from './pause.js';
import { makeResumeCommand } from './resume.js';
import { makeSkipCommand } from './skip.js';
import { makeStopCommand } from './stop.js';
import { makeLeaveCommand } from './leave.js';
import { makeNowPlayingCommand } from './nowplaying.js';
import { makeQueueCommand } from './queue.js';

export * from './types.js';
export * from './ping.js';
export * from './input.js';
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
 * The static commands list is used for slash command registration (deploy-commands).
 */
export function buildCommands(
  playerManager: GuildPlayerManager,
  resolver: TrackResolver,
): readonly Command[] {
  return [
    pingCommand,
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

/** All command data for slash-command registration (no runtime deps). */
export const allCommandData: readonly Command['data'][] = [
  pingCommand.data,
  { name: 'play', toJSON: () => ({ name: 'play', description: 'Play a song or playlist.', type: 1 }) },
  { name: 'pause', toJSON: () => ({ name: 'pause', description: 'Pause playback.', type: 1 }) },
  { name: 'resume', toJSON: () => ({ name: 'resume', description: 'Resume paused playback.', type: 1 }) },
  { name: 'skip', toJSON: () => ({ name: 'skip', description: 'Skip the current track.', type: 1 }) },
  { name: 'stop', toJSON: () => ({ name: 'stop', description: 'Stop and clear queue.', type: 1 }) },
  { name: 'leave', toJSON: () => ({ name: 'leave', description: 'Leave voice channel.', type: 1 }) },
  { name: 'nowplaying', toJSON: () => ({ name: 'nowplaying', description: 'Show now playing.', type: 1 }) },
  { name: 'queue', toJSON: () => ({ name: 'queue', description: 'Show the queue.', type: 1 }) },
];
