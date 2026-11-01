import type { Command } from './types.js';
import type { GuildPlayerManager } from '../player/guild-player.js';
import type { TrackResolver } from '../provider/resolver.js';
import { buildCommands } from './index.js';
import { audioCommandData } from './audio-registry.js';
import type { CommandDefinition } from '../modules/core/types.js';

// Repositories & Services
import { ModerationRepository } from '../database/repositories/moderation-repository.js';
import { TicketRepository } from '../database/repositories/ticket-repository.js';
import { LevelRepository } from '../database/repositories/level-repository.js';
import { PrismaSecurityRepository } from '../database/repositories/security-repository.js';
import { PrismaCommunityRepository } from '../database/repositories/community-repository.js';
import { GiveawayRepository } from '../database/repositories/giveaway-repository.js';
import { EconomyRepository } from '../database/repositories/economy-repository.js';

import { ModerationService, createModerationCommands } from '../modules/moderation/index.js';
import { MemoryLoggingStore, createLoggingCommands } from '../modules/logging/index.js';
import { TicketService, createTicketCommands } from '../modules/tickets/index.js';
import { VerificationService, createVerificationCommands } from '../modules/verification/index.js';
import { LevelingService, createLevelingCommands } from '../modules/leveling/index.js';
import { VoiceRoomService, createVoiceRoomCommands } from '../modules/voice-rooms/index.js';
import { SecurityService, createSecurityCommands } from '../modules/security/index.js';
import { CommunityService, createCommunityCommands } from '../modules/community/index.js';
import { GiveawayService, createGiveawayCommands } from '../modules/giveaways/index.js';
import { createEconomyCommands } from '../modules/economy/index.js';
import { AiService, createAiCommands } from '../modules/ai/index.js';
import { BackupService, createBackupCommands } from '../modules/backup/index.js';
import { PrefixService, createPrefixCommands } from '../modules/prefix/index.js';
import { createUtilityCommands, createExtendedUtilityCommands } from '../modules/utility/index.js';
import { createFunCommands } from '../modules/fun/index.js';
import { createStaffCommands } from '../modules/core/staff-commands.js';
import { StaffPermissionEngine } from '../modules/core/staff-permissions.js';
import { PrismaStaffRepository } from '../database/repositories/staff-repository.js';

/**
 * Transforms an internal CommandDefinition into an executable Command.
 */
function toCommand(def: CommandDefinition): Command {
  const data = def.data ?? {
    name: def.name,
    toJSON: () => ({
      name: def.name,
      description: def.description,
    }),
  };

  return {
    data,
    execute: async (interaction) => {
      await def.execute(interaction);
    },
  };
}

/**
 * Builds the complete list of all Riffly commands across every module.
 */
export function buildMasterCommands(
  playerManager?: GuildPlayerManager,
  resolver?: TrackResolver,
): readonly Command[] {
  const commands: Command[] = [];

  // 1. Music commands (if player stack provided, otherwise fallback stubs for global mapping)
  if (playerManager && resolver) {
    commands.push(...buildCommands(playerManager, resolver));
  } else {
    for (const data of audioCommandData) {
      commands.push({
        data,
        execute: async () => {},
      });
    }
  }

  // 2. Staff hierarchy commands
  const staffEngine = new StaffPermissionEngine(new PrismaStaffRepository());
  for (const def of createStaffCommands(staffEngine)) {
    commands.push(toCommand(def));
  }

  // 3. Moderation suite
  const modRepo = new ModerationRepository();
  const modService = new ModerationService(modRepo);
  for (const def of createModerationCommands(modService)) {
    commands.push(toCommand(def));
  }

  // 4. Logging system
  const loggingStore = new MemoryLoggingStore();
  for (const def of createLoggingCommands(loggingStore)) {
    commands.push(toCommand(def));
  }

  // 5. Tickets
  const ticketRepo = new TicketRepository();
  const ticketService = new TicketService(ticketRepo);
  for (const def of createTicketCommands(ticketService)) {
    commands.push(toCommand(def));
  }

  // 6. Verification
  const verifyService = new VerificationService();
  for (const def of createVerificationCommands(verifyService)) {
    commands.push(toCommand(def));
  }

  // 7. Leveling & Leaderboards
  const levelRepo = new LevelRepository();
  const levelService = new LevelingService(levelRepo);
  for (const def of createLevelingCommands(levelService)) {
    commands.push(toCommand(def));
  }

  // 8. Voice Rooms (VoiceMaster)
  const voiceRoomService = new VoiceRoomService();
  for (const def of createVoiceRoomCommands(voiceRoomService)) {
    commands.push(toCommand(def));
  }

  // 9. Security Defenses (Anti-nuke, Anti-raid, AutoMod)
  const secRepo = new PrismaSecurityRepository();
  const secService = new SecurityService(secRepo);
  for (const def of createSecurityCommands(secService)) {
    commands.push(toCommand(def));
  }

  // 10. Community & Engagement
  const commRepo = new PrismaCommunityRepository();
  const commService = new CommunityService(commRepo);
  for (const def of createCommunityCommands(commService)) {
    commands.push(toCommand(def));
  }

  // 11. Giveaways
  const giveawayRepo = new GiveawayRepository();
  const giveawayService = new GiveawayService(giveawayRepo);
  for (const def of createGiveawayCommands(giveawayService)) {
    commands.push(toCommand(def));
  }

  // 12. Virtual Economy
  const ecoRepo = new EconomyRepository();
  for (const def of createEconomyCommands(ecoRepo, '🪙')) {
    commands.push(toCommand(def));
  }

  // 13. AI Assistant
  const aiService = new AiService();
  for (const def of createAiCommands(aiService)) {
    commands.push(toCommand(def));
  }

  // 14. Server Backups
  const backupService = new BackupService();
  for (const def of createBackupCommands(backupService)) {
    commands.push(toCommand(def));
  }

  // 15. Utility & Information
  for (const def of createUtilityCommands()) {
    commands.push(toCommand(def));
  }
  for (const def of createExtendedUtilityCommands()) {
    commands.push(toCommand(def));
  }

  // 16. Fun & Roleplay
  for (const def of createFunCommands()) {
    commands.push(toCommand(def));
  }

  // 17. Prefix & Server Templates
  const prefixService = new PrefixService();
  for (const def of createPrefixCommands(prefixService)) {
    commands.push(toCommand(def));
  }

  return commands;
}

/**
 * Builds a Map of command name -> Command definition.
 */
export function buildMasterCommandMap(
  playerManager?: GuildPlayerManager,
  resolver?: TrackResolver,
): Map<string, Command> {
  const map = new Map<string, Command>();
  for (const cmd of buildMasterCommands(playerManager, resolver)) {
    map.set(cmd.data.name, cmd);
  }
  return map;
}

/**
 * 100 curated global slash command names representing full feature parity
 * across all 18 specification modules within Discord's 100 application command limit.
 */
export const GLOBAL_SLASH_COMMAND_NAMES: readonly string[] = [
  // Music & Audio (18)
  'play',
  'pause',
  'resume',
  'skip',
  'stop',
  'join',
  'leave',
  'nowplaying',
  'queue',
  'volume',
  'loop',
  'shuffle',
  'seek',
  'remove',
  'clear',
  'filter',
  'autoplay',
  'ping',
  // Help & Info (2)
  'help',
  'info',
  // Staff Hierarchy (3)
  'extraowner',
  'admin',
  'mod',
  // Moderation (22)
  'ban',
  'unban',
  'kick',
  'timeout',
  'mute',
  'unmute',
  'softban',
  'warn',
  'warnings',
  'cases',
  'case',
  'note',
  'jail',
  'purge',
  'slowmode',
  'lock',
  'unlock',
  'hide',
  'unhide',
  'role',
  'nick',
  'move',
  // Logging (1)
  'logging',
  // Tickets & Verification (2)
  'ticket',
  'verify',
  // Leveling & Leaderboards (3)
  'rank',
  'levels',
  'leaderboard',
  // Voice Rooms (2)
  'voicemaster',
  'vc',
  // Security Defenses (3)
  'antinuke',
  'antiraid',
  'automod',
  // Community Features (7)
  'autorole',
  'reactionrole',
  'vanityrole',
  'boosterrole',
  'clownboard',
  'counter',
  'autoresponder',
  // Giveaways (1)
  'giveaway',
  // Virtual Economy (8)
  'balance',
  'daily',
  'work',
  'pay',
  'beg',
  'gamble',
  'deposit',
  'withdraw',
  // AI Assistant (1)
  'ask',
  // Server Backups (1)
  'backup',
  // Utility & Server Management (17)
  'userinfo',
  'serverinfo',
  'avatar',
  'poll',
  'remindme',
  'afk',
  'suggest',
  'report',
  'announce',
  'embed',
  'snipe',
  'crypto',
  'color',
  'weather',
  'translate',
  'define',
  'wiki',
  // Fun & Games (8)
  'github',
  'tictactoe',
  'trivia',
  'meme',
  'urban',
  'fun',
  'rp',
  'image',
  // Prefix & Config (1)
  'prefix',
];

/**
 * Returns the 100 global slash commands configured for Discord REST registration.
 */
export function getGlobalSlashCommands(
  playerManager?: GuildPlayerManager,
  resolver?: TrackResolver,
): readonly Command[] {
  const masterMap = buildMasterCommandMap(playerManager, resolver);
  const result: Command[] = [];
  for (const name of GLOBAL_SLASH_COMMAND_NAMES) {
    const cmd = masterMap.get(name);
    if (cmd) {
      result.push(cmd);
    }
  }
  return result;
}

/**
 * All real SlashCommandBuilder definitions for registration via Discord REST API (capped at 100).
 */
export const allCommandData: readonly Command['data'][] = getGlobalSlashCommands().map(
  (c) => c.data,
);
