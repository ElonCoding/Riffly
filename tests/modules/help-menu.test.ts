import { describe, expect, it } from 'vitest';
import {
  HELP_CATEGORIES,
  buildHelpOverviewEmbed,
  buildHelpMainEmbed,
  buildHelpExtraEmbed,
  buildHelpCategoryEmbed,
  buildHelpActionRows,
} from '../../src/modules/utility/help-menu.js';

describe('Help Menu Matrix Suite', () => {
  it('contains all 11 core and auxiliary categories', () => {
    expect(HELP_CATEGORIES.length).toBeGreaterThanOrEqual(11);
    const ids = HELP_CATEGORIES.map((c) => c.id);
    expect(ids).toContain('music');
    expect(ids).toContain('moderation');
    expect(ids).toContain('security');
    expect(ids).toContain('tickets');
    expect(ids).toContain('leveling');
    expect(ids).toContain('voicemaster');
    expect(ids).toContain('giveaways');
    expect(ids).toContain('community');
    expect(ids).toContain('economy');
    expect(ids).toContain('fun');
    expect(ids).toContain('utility');
  });

  it('builds overview embed matching security & operations matrix specifications', () => {
    const embed = buildHelpOverviewEmbed();
    expect(embed.data.title).toContain('RIFFLY SECURITY & OPERATIONS MATRIX');
    expect(embed.data.description).toContain('Commands:');
    expect(embed.data.description).toContain('Registered');
    expect(embed.data.description).toContain('Modules:');
    expect(embed.data.description).toContain('Active');
    expect(embed.data.fields).toHaveLength(2);
    expect(embed.data.fields?.[0]?.name).toBe('Core Systems');
    expect(embed.data.fields?.[1]?.name).toBe('Auxiliary Suite');
  });

  it('builds main module directory embed', () => {
    const embed = buildHelpMainEmbed();
    expect(embed.data.title).toContain('RIFFLY CORE SYSTEMS DIRECTORY');
    expect(embed.data.fields?.length).toBeGreaterThan(0);
  });

  it('builds extra module directory embed', () => {
    const embed = buildHelpExtraEmbed();
    expect(embed.data.title).toContain('RIFFLY AUXILIARY SUITE DIRECTORY');
    expect(embed.data.fields?.length).toBeGreaterThan(0);
  });

  it('builds granular category embed for music', () => {
    const embed = buildHelpCategoryEmbed(null, null, 'music');
    expect(embed.data.title).toContain('MUSIC & AUDIO MATRIX');
    expect(embed.data.description).toContain('/play');
    expect(embed.data.description).toContain('/queue');
    expect(embed.data.description).toContain('/filter');
  });

  it('generates interactive action rows with buttons and select menu', () => {
    const rows = buildHelpActionRows('overview');
    expect(rows).toHaveLength(2);
    const buttonsRow = rows[0]?.toJSON();
    const selectRow = rows[1]?.toJSON();

    expect(buttonsRow?.components).toHaveLength(3);
    expect(selectRow?.components).toHaveLength(1);
  });
});
