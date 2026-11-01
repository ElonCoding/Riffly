import type { Command } from './types.js';
import { pingCommand } from './ping.js';
import { joinCommandData } from './join.js';
import { playCommandData } from './play.js';
import { pauseCommandData } from './pause.js';
import { resumeCommandData } from './resume.js';
import { skipCommandData } from './skip.js';
import { stopCommandData } from './stop.js';
import { leaveCommandData } from './leave.js';
import { nowPlayingCommandData } from './nowplaying.js';
import { queueCommandData } from './queue.js';
import { volumeCommandData } from './volume.js';
import { loopCommandData } from './loop.js';
import { shuffleCommandData } from './shuffle.js';
import { seekCommandData } from './seek.js';
import { removeCommandData } from './remove.js';
import { clearCommandData } from './clear.js';
import { filterCommandData } from './filter.js';
import { autoplayCommandData } from './autoplay.js';

/**
 * All real SlashCommandBuilder definitions for music module.
 */
export const audioCommandData: readonly Command['data'][] = [
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
  volumeCommandData,
  loopCommandData,
  shuffleCommandData,
  seekCommandData,
  removeCommandData,
  clearCommandData,
  filterCommandData,
  autoplayCommandData,
];

