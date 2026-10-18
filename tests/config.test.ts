import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../src/config.js';

const VALID_TOKEN = 'test-token-value';
const VALID_CLIENT_ID = '123456789012345678';

describe('loadConfig', () => {
  it('returns a valid config with a guild id', () => {
    const config = loadConfig({
      DISCORD_TOKEN: VALID_TOKEN,
      DISCORD_CLIENT_ID: VALID_CLIENT_ID,
      DISCORD_GUILD_ID: '987654321098765432',
    });

    expect(config).toEqual({
      discordToken: VALID_TOKEN,
      discordClientId: VALID_CLIENT_ID,
      discordGuildId: '987654321098765432',
    });
  });

  it('omits an empty optional guild id', () => {
    const config = loadConfig({
      DISCORD_TOKEN: VALID_TOKEN,
      DISCORD_CLIENT_ID: VALID_CLIENT_ID,
      DISCORD_GUILD_ID: '   ',
    });

    expect(config.discordGuildId).toBeUndefined();
  });

  it('trims surrounding whitespace', () => {
    const config = loadConfig({
      DISCORD_TOKEN: `  ${VALID_TOKEN}  `,
      DISCORD_CLIENT_ID: ` ${VALID_CLIENT_ID} `,
    });

    expect(config.discordToken).toBe(VALID_TOKEN);
    expect(config.discordClientId).toBe(VALID_CLIENT_ID);
  });

  it('rejects a missing token and a missing client id', () => {
    expect(() => loadConfig({})).toThrow(ConfigError);

    try {
      loadConfig({});
      expect.unreachable('loadConfig should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      if (error instanceof ConfigError) {
        expect(error.problems).toHaveLength(2);
        expect(error.message).toContain('DISCORD_TOKEN is required');
        expect(error.message).toContain('DISCORD_CLIENT_ID is required');
      }
    }
  });

  it('rejects a non-numeric client id', () => {
    expect(() =>
      loadConfig({ DISCORD_TOKEN: VALID_TOKEN, DISCORD_CLIENT_ID: 'not-a-snowflake' }),
    ).toThrow(/DISCORD_CLIENT_ID must be a numeric Discord snowflake/);
  });

  it('rejects a malformed optional guild id', () => {
    expect(() =>
      loadConfig({
        DISCORD_TOKEN: VALID_TOKEN,
        DISCORD_CLIENT_ID: VALID_CLIENT_ID,
        DISCORD_GUILD_ID: 'abc',
      }),
    ).toThrow(/DISCORD_GUILD_ID, when set/);
  });

  it('never echoes secret values in the error message', () => {
    const secret = 'secret token with spaces';

    try {
      loadConfig({ DISCORD_TOKEN: secret, DISCORD_CLIENT_ID: VALID_CLIENT_ID });
      expect.unreachable('loadConfig should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as Error).message).not.toContain(secret);
    }
  });
});
