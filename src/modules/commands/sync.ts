import {
  Routes,
  type REST,
  type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from 'discord.js';
import type { CommandDefinition, ModuleLogger } from '../core/types.js';
import type { ModuleRegistry } from '../core/registry.js';
import type { CommandRegistrationResult } from '../../deploy-commands.js';

export const DEFAULT_COMMAND_SYNC_DEBOUNCE_MS = 5000;

export interface CommandSynchronizerOptions {
  readonly rest: REST;
  readonly clientId: string;
  readonly registry?: ModuleRegistry | undefined;
  readonly debounceMs?: number | undefined;
  readonly logger?: ModuleLogger | undefined;
  readonly onSyncSuccess?: ((guildId: string, commandCount: number) => void) | undefined;
  readonly onSyncError?: ((guildId: string, error: unknown) => void) | undefined;
}

interface PendingSyncEntry {
  timer: NodeJS.Timeout;
  commands?: readonly CommandDefinition[] | undefined;
  resolvers: Array<(result: CommandRegistrationResult) => void>;
  rejecters: Array<(error: unknown) => void>;
}

/**
 * Converts internal CommandDefinition records into Discord REST API JSON bodies.
 */
export function formatCommandPayload(
  commands: readonly CommandDefinition[],
): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
  return commands.map((cmd) => {
    if (cmd.data) {
      if (typeof cmd.data.toJSON === 'function') {
        return cmd.data.toJSON();
      }
    }

    const payload: RESTPostAPIChatInputApplicationCommandsJSONBody = {
      name: cmd.name,
      description: cmd.description,
      default_member_permissions:
        cmd.defaultMemberPermissions !== undefined && cmd.defaultMemberPermissions !== null
          ? String(cmd.defaultMemberPermissions)
          : null,
      dm_permission: cmd.guildOnly ? false : true,
    };

    return payload;
  });
}

/**
 * Debounced REST command synchronizer managing per-guild slash command registration.
 *
 * Implements a strict 5-second debounce window per guild to prevent Discord REST
 * rate limits when multiple commands or modules update concurrently.
 */
export class CommandSynchronizer {
  private readonly rest: REST;
  private readonly clientId: string;
  private registry: ModuleRegistry | undefined;
  private readonly debounceMs: number;
  private readonly logger: ModuleLogger | undefined;
  private readonly onSyncSuccess: ((guildId: string, commandCount: number) => void) | undefined;
  private readonly onSyncError: ((guildId: string, error: unknown) => void) | undefined;

  private readonly pendingSyncs = new Map<string, PendingSyncEntry>();

  constructor(options: CommandSynchronizerOptions) {
    if (!options.rest) {
      throw new Error('[CommandSynchronizer] Discord REST instance is required.');
    }
    if (!options.clientId) {
      throw new Error('[CommandSynchronizer] Client ID is required.');
    }

    this.rest = options.rest;
    this.clientId = options.clientId;
    this.registry = options.registry;
    this.debounceMs = options.debounceMs ?? DEFAULT_COMMAND_SYNC_DEBOUNCE_MS;
    this.logger = options.logger;
    this.onSyncSuccess = options.onSyncSuccess;
    this.onSyncError = options.onSyncError;
  }

  /**
   * Sets or updates the active ModuleRegistry.
   */
  public setRegistry(registry: ModuleRegistry): this {
    this.registry = registry;
    return this;
  }

  /**
   * Queues a debounced per-guild command sync.
   * If invoked repeatedly within the debounce window (default 5000ms),
   * the timer resets and only the latest command set is registered.
   *
   * @param guildId Discord Guild Snowflake
   * @param commands Optional command list. If omitted, pulls active commands from ModuleRegistry.
   * @returns Promise resolving to CommandRegistrationResult once the debounced sync completes.
   */
  public queueGuildSync(
    guildId: string,
    commands?: readonly CommandDefinition[],
  ): Promise<CommandRegistrationResult> {
    return new Promise((resolve, reject) => {
      const existing = this.pendingSyncs.get(guildId);

      if (existing) {
        clearTimeout(existing.timer);
        existing.commands = commands ?? existing.commands;
        existing.resolvers.push(resolve);
        existing.rejecters.push(reject);

        existing.timer = setTimeout(() => {
          void this.executeGuildSync(guildId);
        }, this.debounceMs);
        return;
      }

      const entry: PendingSyncEntry = {
        timer: setTimeout(() => {
          void this.executeGuildSync(guildId);
        }, this.debounceMs),
        commands,
        resolvers: [resolve],
        rejecters: [reject],
      };

      this.pendingSyncs.set(guildId, entry);
    });
  }

  /**
   * Immediately registers commands for a guild, bypassing and canceling any pending debounce timer.
   */
  public async syncGuildNow(
    guildId: string,
    commands?: readonly CommandDefinition[],
  ): Promise<CommandRegistrationResult> {
    const existing = this.pendingSyncs.get(guildId);
    if (existing) {
      clearTimeout(existing.timer);
      this.pendingSyncs.delete(guildId);
    }

    try {
      const result = await this.performRestPut(guildId, commands ?? existing?.commands);
      if (existing) {
        for (const res of existing.resolvers) {
          res(result);
        }
      }
      return result;
    } catch (err: unknown) {
      if (existing) {
        for (const rej of existing.rejecters) {
          rej(err);
        }
      }
      throw err;
    }
  }

  /**
   * Cancels any pending debounced sync for a guild.
   */
  public cancelGuildSync(guildId: string): boolean {
    const existing = this.pendingSyncs.get(guildId);
    if (!existing) {
      return false;
    }

    clearTimeout(existing.timer);
    this.pendingSyncs.delete(guildId);

    const cancelErr = new Error(`Command sync for guild "${guildId}" was cancelled.`);
    for (const rej of existing.rejecters) {
      rej(cancelErr);
    }

    return true;
  }

  /**
   * Checks whether a guild has a pending debounced sync.
   */
  public isPending(guildId: string): boolean {
    return this.pendingSyncs.has(guildId);
  }

  /**
   * Returns list of guild IDs currently queued in the debounce window.
   */
  public getPendingGuilds(): readonly string[] {
    return Array.from(this.pendingSyncs.keys());
  }

  /**
   * Cleans up all active debounce timers.
   */
  public destroy(): void {
    for (const entry of this.pendingSyncs.values()) {
      clearTimeout(entry.timer);
      const destroyErr = new Error('CommandSynchronizer destroyed.');
      for (const rej of entry.rejecters) {
        rej(destroyErr);
      }
    }
    this.pendingSyncs.clear();
  }

  /**
   * Internal timer handler executing the REST registration.
   */
  private async executeGuildSync(guildId: string): Promise<void> {
    const entry = this.pendingSyncs.get(guildId);
    if (!entry) {
      return;
    }

    this.pendingSyncs.delete(guildId);

    try {
      const result = await this.performRestPut(guildId, entry.commands);
      for (const res of entry.resolvers) {
        res(result);
      }
    } catch (err: unknown) {
      for (const rej of entry.rejecters) {
        rej(err);
      }
    }
  }

  /**
   * Resolves command definitions and executes the REST PUT request.
   */
  private async performRestPut(
    guildId: string,
    explicitCommands?: readonly CommandDefinition[],
  ): Promise<CommandRegistrationResult> {
    let commands = explicitCommands;

    if (!commands && this.registry) {
      commands = this.registry.getCommandsForGuild(guildId);
    }

    const commandList = commands ?? [];
    const payload = formatCommandPayload(commandList);

    if (this.logger) {
      this.logger.info(
        `Synchronizing ${payload.length} command(s) to guild ${guildId} via Discord REST...`,
      );
    }

    try {
      await this.rest.put(Routes.applicationGuildCommands(this.clientId, guildId), {
        body: payload,
      });

      const result: CommandRegistrationResult = {
        scope: 'guild',
        targetId: guildId,
        commandCount: payload.length,
      };

      if (this.onSyncSuccess) {
        this.onSyncSuccess(guildId, payload.length);
      }

      return result;
    } catch (restErr: unknown) {
      if (this.logger) {
        this.logger.error(
          `Failed to sync commands to guild ${guildId}: ${restErr instanceof Error ? restErr.message : String(restErr)}`,
        );
      }

      if (this.onSyncError) {
        this.onSyncError(guildId, restErr);
      }

      throw restErr;
    }
  }
}
