import { ConfigError, loadConfig } from './config.js';
import { createBot } from './bot.js';
import { RifflyDashboardServer } from './dashboard/index.js';

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

  // If deployed with a web port (e.g. Render Web Service), bind Dashboard & REST API
  const rawPort = process.env.PORT ?? process.env.DASHBOARD_PORT;
  let dashboardServer: RifflyDashboardServer | undefined;
  if (rawPort) {
    const port = Number.parseInt(rawPort, 10);
    if (!Number.isNaN(port)) {
      dashboardServer = new RifflyDashboardServer({
        port,
        client: bot.client,
        ...(bot.playerManager ? { playerManager: bot.playerManager } : {}),
      });
      await dashboardServer.start(port);
      console.log(`[Dashboard] Riffly Web Dashboard & API listening on port ${port}`);
    }
  }

  let isShuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (isShuttingDown) {
      return;
    }
    isShuttingDown = true;
    console.log(`[Shutdown] Received ${signal}. Starting graceful shutdown...`);
    if (dashboardServer) {
      await dashboardServer.stop();
    }
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
    // Synchronize latest slash commands to Discord on startup
    const { registerCommands } = await import('./deploy-commands.js');
    void registerCommands(config).catch((err: unknown) => {
      console.warn(
        '[Startup] Slash command registration notice:',
        err instanceof Error ? err.message : err,
      );
    });

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
