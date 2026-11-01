import { describe, expect, it } from 'vitest';
import { allCommandData } from '../src/commands/index.js';
import { buildMasterCommands, buildMasterCommandMap } from '../src/commands/master-registry.js';

describe('Global Slash Command Registry Inventory', () => {
  it('ensures allCommandData respects Discord 100 global command limit', () => {
    expect(allCommandData.length).toBeGreaterThan(0);
    expect(allCommandData.length).toBeLessThanOrEqual(100);

    const names = new Set<string>();
    for (const cmdData of allCommandData) {
      expect(cmdData.name).toBeDefined();
      expect(typeof cmdData.toJSON).toBe('function');
      const json = cmdData.toJSON();
      expect(json.name).toBe(cmdData.name);
      expect(json.description).toBeDefined();
      expect(names.has(cmdData.name)).toBe(false);
      names.add(cmdData.name);
    }
  });

  it('builds master command map with all commands across platform', () => {
    const commands = buildMasterCommands();
    const map = buildMasterCommandMap();

    expect(commands.length).toBeGreaterThanOrEqual(100);
    expect(map.size).toBeGreaterThanOrEqual(100);

    // Essential commands check
    expect(map.has('play')).toBe(true);
    expect(map.has('pause')).toBe(true);
    expect(map.has('ban')).toBe(true);
    expect(map.has('ticket')).toBe(true);
    expect(map.has('verify')).toBe(true);
    expect(map.has('antinuke')).toBe(true);
    expect(map.has('antiraid')).toBe(true);
    expect(map.has('automod')).toBe(true);
    expect(map.has('autorole')).toBe(true);
    expect(map.has('vc')).toBe(true);
    expect(map.has('voicemaster')).toBe(true);
    expect(map.has('leaderboard')).toBe(true);
    expect(map.has('rank')).toBe(true);
    expect(map.has('balance')).toBe(true);
    expect(map.has('prefix')).toBe(true);
    expect(map.has('template')).toBe(true);
  });
});
