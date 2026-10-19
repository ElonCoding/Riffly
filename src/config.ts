/**
 * Environment configuration loading and validation.
 *
 * Fails fast with an actionable, secret-free error when required values are
 * missing or malformed. Never include raw secret values in thrown messages.
 */

export interface LavalinkConfig {
  readonly host: string;
  readonly port: number;
  readonly password: string;
  readonly secure: boolean;
}

export interface AppConfig {
  readonly discordToken: string;
  readonly discordClientId: string;
  readonly discordGuildId?: string;
  readonly lavalink: LavalinkConfig;
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
interface ParsedHost {
  host: string;
  inferredSecure?: boolean | undefined;
  inferredPort?: number | undefined;
}

function parseLavalinkHost(rawInput: string): ParsedHost {
  let cleaned = rawInput.trim();
  let inferredSecure: boolean | undefined;
  let inferredPort: number | undefined;

  if (cleaned.startsWith('https://') || cleaned.startsWith('wss://')) {
    inferredSecure = true;
    inferredPort = 443;
    cleaned = cleaned.replace(/^(https?|wss?):\/\//, '');
  } else if (cleaned.startsWith('http://') || cleaned.startsWith('ws://')) {
    inferredSecure = false;
    cleaned = cleaned.replace(/^(https?|wss?):\/\//, '');
  }

  // Remove trailing slashes and URL path segments (e.g. "my-host.onrender.com/version")
  cleaned = cleaned.split('/')[0] ?? '';

  // Extract inline port if present (e.g. "my-host.com:2333")
  if (cleaned.includes(':')) {
    const parts = cleaned.split(':');
    cleaned = parts[0] ?? '';
    const parsedPort = Number.parseInt(parts[1] ?? '', 10);
    if (Number.isInteger(parsedPort) && parsedPort >= 1 && parsedPort <= 65535) {
      inferredPort = parsedPort;
    }
  }

  // Public Render services always run on HTTPS/WSS (port 443, secure)
  if (cleaned.endsWith('.onrender.com')) {
    if (inferredSecure === undefined) inferredSecure = true;
    if (inferredPort === undefined) inferredPort = 443;
  }

  return { host: cleaned, inferredSecure, inferredPort };
}

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

  const rawLavalinkHost = readEnv(env, 'LAVALINK_HOST');
  let lavalinkHost = 'localhost';
  let inferredSecure: boolean | undefined;
  let inferredPort: number | undefined;

  if (rawLavalinkHost.length > 0) {
    const parsed = parseLavalinkHost(rawLavalinkHost);
    lavalinkHost = parsed.host;
    inferredSecure = parsed.inferredSecure;
    inferredPort = parsed.inferredPort;

    if (lavalinkHost.length === 0 || /\s/.test(lavalinkHost)) {
      problems.push('LAVALINK_HOST must be a valid hostname without whitespace.');
    }
  }

  const rawLavalinkPort = readEnv(env, 'LAVALINK_PORT');
  let lavalinkPort = inferredPort ?? 2333;
  if (rawLavalinkPort.length > 0) {
    const parsed = Number.parseInt(rawLavalinkPort, 10);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
      problems.push('LAVALINK_PORT, when set, must be an integer between 1 and 65535.');
    } else {
      lavalinkPort = parsed;
    }
  }

  const lavalinkPassword = readEnv(env, 'LAVALINK_PASSWORD') || 'youshallnotpass';

  const rawLavalinkSecure = readEnv(env, 'LAVALINK_SECURE');
  let lavalinkSecure = inferredSecure ?? false;
  if (rawLavalinkSecure.length > 0) {
    if (rawLavalinkSecure === 'true') {
      lavalinkSecure = true;
    } else if (rawLavalinkSecure === 'false') {
      lavalinkSecure = false;
    } else {
      problems.push("LAVALINK_SECURE, when set, must be 'true' or 'false'.");
    }
  }

  if (problems.length > 0) {
    throw new ConfigError(problems);
  }

  return {
    discordToken,
    discordClientId,
    ...(discordGuildId.length > 0 ? { discordGuildId } : {}),
    lavalink: {
      host: lavalinkHost,
      port: lavalinkPort,
      password: lavalinkPassword,
      secure: lavalinkSecure,
    },
  };
}
