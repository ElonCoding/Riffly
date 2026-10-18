/**
 * Environment configuration loading and validation.
 *
 * Fails fast with an actionable, secret-free error when required values are
 * missing or malformed. Never include raw secret values in thrown messages.
 */

export interface AppConfig {
  readonly discordToken: string;
  readonly discordClientId: string;
  readonly discordGuildId?: string;
}

/** Discord snowflakes are numeric strings; 17-20 digits covers current IDs. */
const SNOWFLAKE_PATTERN = /^\d{17,20}$/;

export class ConfigError extends Error {
  readonly problems: readonly string[];

  constructor(problems: readonly string[]) {
    super(`Invalid configuration:\n- ${problems.join('\n- ')}`);
    this.name = 'ConfigError';
    this.problems = problems;
  }
}

function readEnv(env: NodeJS.ProcessEnv, key: string): string {
  return (env[key] ?? '').trim();
}

/**
 * Load and validate configuration from an environment-like object.
 *
 * @throws {ConfigError} when any required value is missing or malformed.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const problems: string[] = [];

  const discordToken = readEnv(env, 'DISCORD_TOKEN');
  if (discordToken.length === 0) {
    problems.push('DISCORD_TOKEN is required (see .env.example).');
  } else if (/\s/.test(discordToken)) {
    problems.push('DISCORD_TOKEN must not contain whitespace.');
  }

  const discordClientId = readEnv(env, 'DISCORD_CLIENT_ID');
  if (discordClientId.length === 0) {
    problems.push('DISCORD_CLIENT_ID is required (see .env.example).');
  } else if (!SNOWFLAKE_PATTERN.test(discordClientId)) {
    problems.push('DISCORD_CLIENT_ID must be a numeric Discord snowflake (17-20 digits).');
  }

  const discordGuildId = readEnv(env, 'DISCORD_GUILD_ID');
  if (discordGuildId.length > 0 && !SNOWFLAKE_PATTERN.test(discordGuildId)) {
    problems.push(
      'DISCORD_GUILD_ID, when set, must be a numeric Discord snowflake (17-20 digits).',
    );
  }

  if (problems.length > 0) {
    throw new ConfigError(problems);
  }

  return {
    discordToken,
    discordClientId,
    ...(discordGuildId.length > 0 ? { discordGuildId } : {}),
  };
}
