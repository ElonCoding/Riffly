import type { Prisma, PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../client.js';
import type {
  GuildModuleData,
  GuildSettingsData,
  IGuildRepository,
  SaveGuildSettingsInput,
} from '../types.js';

/**
 * Repository for guild settings and module configurations.
 */
export class GuildRepository implements IGuildRepository {
  private readonly client: PrismaClient;

  constructor(client?: PrismaClient) {
    this.client = client ?? getPrismaClient();
  }

  /**
   * Retrieve guild settings by guild ID.
   */
  public async getSettings(guildId: string): Promise<GuildSettingsData | null> {
    const record = await this.client.guildSettings.findUnique({
      where: { guildId },
    });

    if (!record) {
      return null;
    }

    return {
      guildId: record.guildId,
      prefix: record.prefix,
      locale: record.locale,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  /**
   * Save or update guild settings.
   */
  public async saveSettings(
    guildId: string,
    data: SaveGuildSettingsInput,
  ): Promise<GuildSettingsData> {
    const record = await this.client.guildSettings.upsert({
      where: { guildId },
      update: {
        ...(data.prefix !== undefined ? { prefix: data.prefix } : {}),
        ...(data.locale !== undefined ? { locale: data.locale } : {}),
      },
      create: {
        guildId,
        prefix: data.prefix ?? '!',
        locale: data.locale ?? 'en',
      },
    });

    return {
      guildId: record.guildId,
      prefix: record.prefix,
      locale: record.locale,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  /**
   * Retrieve configuration for a specific module in a guild.
   */
  public async getModuleConfig(
    guildId: string,
    moduleId: string,
  ): Promise<GuildModuleData | null> {
    const record = await this.client.guildModule.findUnique({
      where: {
        guildId_moduleId: {
          guildId,
          moduleId,
        },
      },
    });

    if (!record) {
      return null;
    }

    return {
      id: record.id,
      guildId: record.guildId,
      moduleId: record.moduleId,
      enabled: record.enabled,
      settings: (record.settings as Record<string, unknown>) ?? {},
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  /**
   * Enable or disable a module for a guild.
   */
  public async setModuleEnabled(
    guildId: string,
    moduleId: string,
    enabled: boolean,
  ): Promise<GuildModuleData> {
    // Ensure parent guild settings exist
    await this.ensureGuildExists(guildId);

    const record = await this.client.guildModule.upsert({
      where: {
        guildId_moduleId: {
          guildId,
          moduleId,
        },
      },
      update: {
        enabled,
      },
      create: {
        guildId,
        moduleId,
        enabled,
        settings: {},
      },
    });

    return {
      id: record.id,
      guildId: record.guildId,
      moduleId: record.moduleId,
      enabled: record.enabled,
      settings: (record.settings as Record<string, unknown>) ?? {},
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  /**
   * Update settings payload for a specific module in a guild.
   */
  public async updateModuleSettings(
    guildId: string,
    moduleId: string,
    settings: Record<string, unknown>,
  ): Promise<GuildModuleData> {
    // Ensure parent guild settings exist
    await this.ensureGuildExists(guildId);

    const record = await this.client.guildModule.upsert({
      where: {
        guildId_moduleId: {
          guildId,
          moduleId,
        },
      },
      update: {
        settings: settings as Prisma.InputJsonValue,
      },
      create: {
        guildId,
        moduleId,
        enabled: true,
        settings: settings as Prisma.InputJsonValue,
      },
    });

    return {
      id: record.id,
      guildId: record.guildId,
      moduleId: record.moduleId,
      enabled: record.enabled,
      settings: (record.settings as Record<string, unknown>) ?? {},
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  /**
   * Ensure that the GuildSettings record exists prior to foreign key operations.
   */
  private async ensureGuildExists(guildId: string): Promise<void> {
    await this.client.guildSettings.upsert({
      where: { guildId },
      update: {},
      create: {
        guildId,
        prefix: '!',
        locale: 'en',
      },
    });
  }
}
