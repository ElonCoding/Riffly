import { pathToFileURL } from 'node:url';
import { REST, Routes } from 'discord.js';
import type { AppConfig } from './config.js';
import { ConfigError, loadConfig } from './config.js';
import type { Command } from './commands/types.js';
import { commands as defaultCommands } from './commands/index.js';

export interface CommandRegistrationResult {
  readonly scope: 'guild' | 'global';
  readonly targetId: string;
  readonly commandCount: number;
}

export async function registerCommands(
  config: AppConfig,
  customRest?: REST,
  commands: readonly Command[] = defaultCommands,
): Promise<CommandRegistrationResult> {
  const rest = customRest ?? new REST({ version: '10' }).setToken(config.discordToken);
  const payload = commands.map((cmd) => cmd.data.toJSON());

  if (config.discordGuildId) {
    console.log(
      `[CommandRegistration] Registering ${payload.length} slash command(s) to guild ${config.discordGuildId}...`,
    );
    await rest.put(Routes.applicationGuildCommands(config.discordClientId, config.discordGuildId), {
      body: payload,
    });
    return {
      scope: 'guild',
      targetId: config.discordGuildId,
      commandCount: payload.length,
    };
  }

  console.log(
    `[CommandRegistration] Registering ${payload.length} slash command(s) globally for application ${config.discordClientId}...`,
  );
  await rest.put(Routes.applicationCommands(config.discordClientId), { body: payload });
  return {
    scope: 'global',
    targetId: config.discordClientId,
    commandCount: payload.length,
  };
}

export async function runDeploy(): Promise<void> {
  try {
    if (typeof process.loadEnvFile === 'function') {
      try {
        process.loadEnvFile();
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw err;
        }
      }
    }

    const config = loadConfig();
    const result = await registerCommands(config);
    console.log(
      `[CommandRegistration] Successfully registered ${result.commandCount} command(s) (${result.scope} scope).`,
    );
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(`[CommandRegistration] Configuration error:\n${error.message}`);
    } else {
      console.error(
        '[CommandRegistration] Failed to register commands:',
        error instanceof Error ? error.message : error,
      );
    }
    process.exitCode = 1;
  }
}

const isDirectRun =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  void runDeploy();
}
