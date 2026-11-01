import type { PrismaClient } from '@prisma/client';
import { getPrismaClient } from '../client.js';
import type { IStaffRepository, StaffEntry } from '../../modules/core/staff-permissions.js';

export class PrismaStaffRepository implements IStaffRepository {
  private readonly client: PrismaClient;

  constructor(client?: PrismaClient) {
    this.client = client ?? getPrismaClient();
  }

  public async getGuildStaff(guildId: string): Promise<readonly StaffEntry[]> {
    const records = await this.client.staffPermission.findMany({
      where: { guildId },
    });

    return records.map((r) => ({
      targetId: r.targetId,
      targetType: r.targetType as 'user' | 'role',
      tier: r.tier as 'extraowner' | 'admin' | 'mod',
      permissions: parseInt(r.permissions, 10) || 0,
    }));
  }

  public async setStaff(guildId: string, entry: StaffEntry): Promise<void> {
    await this.client.$transaction(async (tx) => {
      await tx.guildSettings.upsert({
        where: { guildId },
        update: {},
        create: { guildId },
      });

      await tx.staffPermission.upsert({
        where: {
          guildId_targetId: {
            guildId,
            targetId: entry.targetId,
          },
        },
        update: {
          targetType: entry.targetType,
          tier: entry.tier,
          permissions: entry.permissions.toString(),
        },
        create: {
          guildId,
          targetId: entry.targetId,
          targetType: entry.targetType,
          tier: entry.tier,
          permissions: entry.permissions.toString(),
        },
      });
    });
  }

  public async removeStaff(guildId: string, targetId: string): Promise<boolean> {
    try {
      await this.client.staffPermission.delete({
        where: {
          guildId_targetId: {
            guildId,
            targetId,
          },
        },
      });
      return true;
    } catch {
      return false;
    }
  }
}

