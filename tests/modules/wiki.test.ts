import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ChatInputCommandInteraction } from 'discord.js';
import { createExtendedUtilityCommands } from '../../src/modules/utility/commands-extended.js';

describe('/wiki Command Suite', () => {
  const commands = createExtendedUtilityCommands();
  const wikiCmd = commands.find((c) => c.name === 'wiki')!;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is registered with correct name, description, and query option', () => {
    expect(wikiCmd).toBeDefined();
    expect(wikiCmd.name).toBe('wiki');
    expect(wikiCmd.description).toContain('Wikipedia');
  });

  it('executes direct Wikipedia lookup and replies publicly in channel', async () => {
    const deferReplyMock = vi.fn().mockResolvedValue(true);
    const editReplyMock = vi.fn().mockResolvedValue(true);

    const mockSummary = {
      type: 'standard',
      title: 'Albert Einstein',
      description: 'Theoretical physicist',
      extract: 'Albert Einstein was a German-born theoretical physicist...',
      thumbnail: { source: 'https://example.com/einstein.jpg' },
      content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Albert_Einstein' } },
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockSummary,
    });
    vi.stubGlobal('fetch', fetchMock);

    const interaction = {
      deferReply: deferReplyMock,
      editReply: editReplyMock,
      options: {
        getString: vi.fn().mockReturnValue('Albert Einstein'),
      },
    } as unknown as ChatInputCommandInteraction;

    await wikiCmd.execute(interaction);

    expect(deferReplyMock).toHaveBeenCalledWith({ ephemeral: false });
    expect(editReplyMock).toHaveBeenCalled();

    const replyData = editReplyMock.mock.calls[0]?.[0];
    expect(replyData.embeds).toBeDefined();
    expect(replyData.components).toBeDefined();
    const embed = replyData.embeds[0];
    expect(embed.data.title).toBe('Albert Einstein');
    expect(embed.data.description).toContain('Albert Einstein was a German-born theoretical physicist');
    expect(embed.data.thumbnail?.url).toBe('https://example.com/einstein.jpg');
  });

  it('falls back to search when direct lookup returns disambiguation or 404', async () => {
    const deferReplyMock = vi.fn().mockResolvedValue(true);
    const editReplyMock = vi.fn().mockResolvedValue(true);

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes('api/rest_v1/page/summary/relativity')) {
        return Promise.resolve({
          ok: false,
          status: 404,
        });
      }
      if (url.includes('/rest.php/v1/search/page')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            pages: [
              { key: 'Theory_of_relativity', title: 'Theory of relativity', description: 'Physics theory' },
              { key: 'General_relativity', title: 'General relativity', description: 'Geometric theory' },
            ],
          }),
        });
      }
      if (url.includes('api/rest_v1/page/summary/Theory_of_relativity')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            type: 'standard',
            title: 'Theory of relativity',
            description: 'Two interrelated theories',
            extract: 'The theory of relativity comprises two physics theories...',
            content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Theory_of_relativity' } },
          }),
        });
      }
      return Promise.reject(new Error('Unexpected URL'));
    });
    vi.stubGlobal('fetch', fetchMock);

    const interaction = {
      deferReply: deferReplyMock,
      editReply: editReplyMock,
      options: {
        getString: vi.fn().mockReturnValue('relativity'),
      },
    } as unknown as ChatInputCommandInteraction;

    await wikiCmd.execute(interaction);

    expect(deferReplyMock).toHaveBeenCalledWith({ ephemeral: false });
    expect(editReplyMock).toHaveBeenCalled();

    const replyData = editReplyMock.mock.calls[0]?.[0];
    const embed = replyData.embeds[0];
    expect(embed.data.title).toBe('Theory of relativity');
    expect(embed.data.fields?.length).toBeGreaterThan(0);
    expect(embed.data.fields[0].name).toContain('Related Topics');
    expect(embed.data.fields[0].value).toContain('General relativity');
  });

  it('handles not found gracefully', async () => {
    const deferReplyMock = vi.fn().mockResolvedValue(true);
    const editReplyMock = vi.fn().mockResolvedValue(true);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);

    const interaction = {
      deferReply: deferReplyMock,
      editReply: editReplyMock,
      options: {
        getString: vi.fn().mockReturnValue('nonexistentxyz99999'),
      },
    } as unknown as ChatInputCommandInteraction;

    await wikiCmd.execute(interaction);

    expect(deferReplyMock).toHaveBeenCalledWith({ ephemeral: false });
    expect(editReplyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('No Wikipedia article found'),
      }),
    );
  });
});
