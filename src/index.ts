import { ConfigError, loadConfig } from './config.js';

function main(): void {
  try {
    const config = loadConfig();
    // Discord client wiring is M0 work tracked in ROADMAP.md; this entrypoint
    // currently proves configuration loading only.
    console.log(`Riffly configured. Client ID: ${config.discordClientId}`);
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(error.message);
      process.exitCode = 1;
      return;
    }
    throw error;
  }
}

main();
