import { PrismaClient } from '@prisma/client';

let prismaInstance: PrismaClient | null = null;
let isShutdownHookRegistered = false;

/**
 * Options for initializing the Prisma client provider.
 */
export interface DatabaseClientOptions {
  logQueries?: boolean;
}

/**
 * Get or initialize the singleton PrismaClient instance for Riffly.
 */
export function getPrismaClient(options: DatabaseClientOptions = {}): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      log: options.logQueries ? ['query', 'info', 'warn', 'error'] : ['warn', 'error'],
    });

    registerGracefulShutdown();
  }

  return prismaInstance;
}

/**
 * Override the singleton PrismaClient instance.
 * Useful for unit testing with mock clients.
 */
export function setPrismaClient(client: PrismaClient | null): void {
  prismaInstance = client;
}

/**
 * Check whether database connectivity is configured in the environment.
 */
export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/**
 * Connect to the database and verify connectivity with a ping.
 */
export async function connectDatabase(client?: PrismaClient): Promise<void> {
  const target = client ?? getPrismaClient();
  try {
    await target.$connect();
    // Verify connection by running a lightweight query
    await target.$queryRawUnsafe('SELECT 1');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`[Database] Failed to connect to PostgreSQL: ${message}`, { cause: err });
  }
}

/**
 * Disconnect and release the PrismaClient connection pool.
 */
export async function disconnectDatabase(client?: PrismaClient): Promise<void> {
  const target = client ?? prismaInstance;
  if (target) {
    try {
      await target.$disconnect();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[Database] Error during disconnect: ${message}`);
    }
  }
  if (!client || client === prismaInstance) {
    prismaInstance = null;
  }
}

/**
 * Register Node.js process termination hooks for clean shutdown.
 */
function registerGracefulShutdown(): void {
  if (isShutdownHookRegistered) return;
  isShutdownHookRegistered = true;

  const onShutdown = async (signal: string) => {
    if (prismaInstance) {
      try {
        await prismaInstance.$disconnect();
      } catch (err: unknown) {
        console.error(`[Database] Error disconnecting on ${signal}:`, err);
      }
    }
  };

  process.once('beforeExit', () => {
    void onShutdown('beforeExit');
  });
}
