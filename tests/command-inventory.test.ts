import { describe, expect, it } from 'vitest';
import { allCommandData } from '../src/commands/index.js';
import {
  GLOBAL_SLASH_COMMAND_NAMES,
  buildMasterCommands,
  buildMasterCommandMap,
} from '../src/commands/master-registry.js';

describe('Global Slash Command Registry Inventory', () => {
  it('ensures allCommandData respects Discord 100 global command limit', () => {
    expect(allCommandData.length).toBeGreaterThan(0);
    expect(allCommandData.length).toBeLessThanOrEqual(100);
    expect(allCommandData.length).toBe(100);
    expect(GLOBAL_SLASH_COMMAND_NAMES.length).toBe(100);

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

  it('verifies /musicdiag replacement of legacy /rp command', () => {
    expect(GLOBAL_SLASH_COMMAND_NAMES).toContain('musicdiag');
    expect(GLOBAL_SLASH_COMMAND_NAMES).not.toContain('rp');

    const musicdiagCmd = allCommandData.find((cmd) => cmd.name === 'musicdiag');
    expect(musicdiagCmd).toBeDefined();
    const json = musicdiagCmd?.toJSON();
    expect(json?.name).toBe('musicdiag');
    expect(json?.description).toContain('diagnostic');

    const rpCmd = allCommandData.find((cmd) => cmd.name === 'rp');
    expect(rpCmd).toBeUndefined();
  });

  it('verifies /github command options include username and repo', () => {
    expect(GLOBAL_SLASH_COMMAND_NAMES).toContain('github');

    const githubCmd = allCommandData.find((cmd) => cmd.name === 'github');
    expect(githubCmd).toBeDefined();

    const json = githubCmd?.toJSON() as {
      name: string;
      description: string;
      options?: Array<{ name: string; description: string; required?: boolean }>;
    };

    expect(json.name).toBe('github');
    expect(json.options).toBeDefined();

    const optionNames = json.options?.map((opt) => opt.name) ?? [];
    expect(optionNames).toContain('username');
    expect(optionNames).toContain('repo');

    const usernameOpt = json.options?.find((opt) => opt.name === 'username');
    expect(usernameOpt?.required).toBe(false);

    const repoOpt = json.options?.find((opt) => opt.name === 'repo');
    expect(repoOpt?.required).toBe(false);
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
    expect(map.has('musicdiag')).toBe(true);
    expect(map.has('github')).toBe(true);
  });
});
