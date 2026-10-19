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

  // If deployed as a Web Service (e.g. Render Web Service), bind HTTP health check to PORT
  const rawPort = process.env.PORT;
  let healthServer: import('node:http').Server | undefined;
  if (rawPort) {
    const port = Number.parseInt(rawPort, 10);
    if (!Number.isNaN(port)) {
      const http = await import('node:http');
      healthServer = http.createServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'healthy', service: 'riffly' }));
      });
      healthServer.listen(port, '0.0.0.0', () => {
        console.log(`[Health] Web service HTTP health check listening on port ${port}`);
      });
    }
  }

  let isShuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (isShuttingDown) {
      return;
    }
    isShuttingDown = true;
    console.log(`[Shutdown] Received ${signal}. Starting graceful shutdown...`);
    if (healthServer) {
      healthServer.close();
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
