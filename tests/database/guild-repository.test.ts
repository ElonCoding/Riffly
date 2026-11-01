import { describe, expect, it, beforeEach } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { GuildRepository } from '../../src/database/repositories/guild-repository.js';
import type { GuildModule, GuildSettings } from '../../src/database/types.js';

/**
 * Stateful in-memory mock of PrismaClient for GuildSettings and GuildModule.
 */
function createMockPrismaClient(): PrismaClient {
  const settingsStore = new Map<string, GuildSettings>();
  const moduleStore = new Map<string, GuildModule>();

  return {
    guildSettings: {
      findUnique: ({ where }: { where: { guildId: string } }) => {
        return Promise.resolve(settingsStore.get(where.guildId) ?? null);
      },
      upsert: ({
        where,
        update,
        create,
      }: {
        where: { guildId: string };
        update: Partial<GuildSettings>;
        create: GuildSettings;
      }) => {
        const existing = settingsStore.get(where.guildId);
        if (existing) {
          const updated: GuildSettings = {
            ...existing,
            ...update,
            updatedAt: new Date(),
          };
          settingsStore.set(where.guildId, updated);
          return Promise.resolve(updated);
        }
        const created: GuildSettings = {
          guildId: create.guildId,
          prefix: create.prefix ?? '!',
          locale: create.locale ?? 'en',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        settingsStore.set(where.guildId, created);
        return Promise.resolve(created);
      },
    },
    guildModule: {
      findUnique: ({
        where,
      }: {
        where: { guildId_moduleId: { guildId: string; moduleId: string } };
      }) => {
        const key = `${where.guildId_moduleId.guildId}:${where.guildId_moduleId.moduleId}`;
        return Promise.resolve(moduleStore.get(key) ?? null);
      },
      upsert: ({
        where,
        update,
        create,
      }: {
        where: { guildId_moduleId: { guildId: string; moduleId: string } };
        update: Partial<GuildModule>;
        create: GuildModule;
      }) => {
        const key = `${where.guildId_moduleId.guildId}:${where.guildId_moduleId.moduleId}`;
        const existing = moduleStore.get(key);
        if (existing) {
          const updated: GuildModule = {
            ...existing,
            ...update,
            updatedAt: new Date(),
          };
          moduleStore.set(key, updated);
          return Promise.resolve(updated);
        }
        const created: GuildModule = {
          id: `cuid_${Date.now()}_${Math.random()}`,
          guildId: create.guildId,
          moduleId: create.moduleId,
          enabled: create.enabled ?? true,
          settings: create.settings ?? {},
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        moduleStore.set(key, created);
        return Promise.resolve(created);
      },
    },
  } as unknown as PrismaClient;
}

describe('GuildRepository', () => {
  let mockClient: PrismaClient;
  let repository: GuildRepository;

  beforeEach(() => {
    mockClient = createMockPrismaClient();
    repository = new GuildRepository(mockClient);
  });

  describe('getSettings', () => {
    it('returns null when guild settings do not exist', async () => {
      const settings = await repository.getSettings('guild-100');
      expect(settings).toBeNull();
    });

    it('returns guild settings when record exists', async () => {
      await repository.saveSettings('guild-100', { prefix: '?' });
      const settings = await repository.getSettings('guild-100');

      expect(settings).not.toBeNull();
      expect(settings?.guildId).toBe('guild-100');
      expect(settings?.prefix).toBe('?');
      expect(settings?.locale).toBe('en');
    });
  });

  describe('saveSettings', () => {
    it('creates new settings with defaults if none exist', async () => {
      const saved = await repository.saveSettings('guild-200', {});

      expect(saved.guildId).toBe('guild-200');
      expect(saved.prefix).toBe('!');
      expect(saved.locale).toBe('en');
      expect(saved.createdAt).toBeInstanceOf(Date);
    });

    it('updates custom prefix and locale', async () => {
      await repository.saveSettings('guild-200', { prefix: '!' });
      const updated = await repository.saveSettings('guild-200', {
        prefix: '.',
        locale: 'fr',
      });

      expect(updated.prefix).toBe('.');
      expect(updated.locale).toBe('fr');
    });

    it('preserves existing prefix when updating only locale', async () => {
      await repository.saveSettings('guild-200', { prefix: '$$' });
      const updated = await repository.saveSettings('guild-200', { locale: 'de' });

      expect(updated.prefix).toBe('$$');
      expect(updated.locale).toBe('de');
    });
  });

  describe('getModuleConfig', () => {
    it('returns null when module configuration does not exist', async () => {
      const config = await repository.getModuleConfig('guild-100', 'music');
      expect(config).toBeNull();
    });

    it('returns module config when present', async () => {
      await repository.setModuleEnabled('guild-100', 'music', true);
      const config = await repository.getModuleConfig('guild-100', 'music');

      expect(config).not.toBeNull();
      expect(config?.guildId).toBe('guild-100');
      expect(config?.moduleId).toBe('music');
      expect(config?.enabled).toBe(true);
      expect(config?.settings).toEqual({});
    });
  });

  describe('setModuleEnabled', () => {
    it('enables a module and creates parent guild record if needed', async () => {
      const mod = await repository.setModuleEnabled('guild-300', 'moderation', true);

      expect(mod.guildId).toBe('guild-300');
      expect(mod.moduleId).toBe('moderation');
      expect(mod.enabled).toBe(true);

      const parentSettings = await repository.getSettings('guild-300');
      expect(parentSettings).not.toBeNull();
    });

    it('disables an enabled module', async () => {
      await repository.setModuleEnabled('guild-300', 'moderation', true);
      const disabled = await repository.setModuleEnabled('guild-300', 'moderation', false);

      expect(disabled.enabled).toBe(false);
    });
  });

  describe('updateModuleSettings', () => {
    it('persists structured JSON settings for a module', async () => {
      const settingsPayload = {
        defaultVolume: 75,
        leaveOnEmpty: true,
        djRole: '123456789',
      };

      const result = await repository.updateModuleSettings(
        'guild-400',
        'music',
        settingsPayload,
      );

      expect(result.guildId).toBe('guild-400');
      expect(result.moduleId).toBe('music');
      expect(result.settings).toEqual(settingsPayload);
      expect(result.enabled).toBe(true);

      const retrieved = await repository.getModuleConfig('guild-400', 'music');
      expect(retrieved?.settings).toEqual(settingsPayload);
    });

    it('overwrites existing module settings on update', async () => {
      await repository.updateModuleSettings('guild-400', 'music', { vol: 50 });
      const updated = await repository.updateModuleSettings('guild-400', 'music', { vol: 80 });

      expect(updated.settings).toEqual({ vol: 80 });
    });
  });
});
