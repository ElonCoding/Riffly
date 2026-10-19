import { ConfigError, loadConfig } from './config.js';
import { createBot } from './bot.js';

async function main(): Promise<void> {
  // Load local .env if present (Render supplies env vars via process.env directly)
  if (typeof process.loadEnvFile === 'function') {
    try {
      process.loadEnvFile();
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }
  }

  let config;
  try {
    config = loadConfig();
    console.log(`[Startup] Riffly starting. Client ID: ${config.discordClientId}`);
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(`[Startup] Configuration error:\n${error.message}`);
      process.exit(1);
    }
    throw error;
  }

  const bot = createBot(config);

  let isShuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (isShuttingDown) {
      return;
    }
    isShuttingDown = true;
    console.log(`[Shutdown] Received ${signal}. Starting graceful shutdown...`);
    try {
      await bot.stop();
      console.log('[Shutdown] Gateway connection closed gracefully.');
      process.exit(0);
    } catch (error) {
      console.error(
        '[Shutdown] Error during shutdown:',
        error instanceof Error ? error.message : error,
      );
      process.exit(1);
    }
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  try {
    await bot.start();
    console.log('[Startup] Bot client started and listening for gateway events.');
  } catch (error) {
    console.error(
      '[Startup] Fatal error starting bot:',
      error instanceof Error ? error.message : 'Unknown gateway error',
    );
    process.exit(1);
  }
}

void main();
