import { describe, expect, it, vi } from 'vitest';
import type { LavalinkManager } from 'lavalink-client';
import { LavalinkProvider } from '../../src/provider/lavalink-provider.js';
import { ProviderRegistry } from '../../src/provider/registry.js';
import { TrackResolver } from '../../src/provider/resolver.js';
import { RifflyError } from '../../src/errors.js';

describe('LavalinkProvider and Playlist Resolution', () => {
  const rawTrack1 = {
    encoded: 'track1-encoded',
    info: {
      title: 'SoundCloud Track 1',
      author: 'SoundCloud Artist',
      duration: 210000,
      identifier: 'sc-1',
      isSeekable: true,
      isStream: false,
      uri: 'https://soundcloud.com/artist/track-1',
      artworkUrl: 'https://soundcloud.com/art1.jpg',
    },
  };

  const rawTrack2 = {
    encoded: 'track2-encoded',
    info: {
      title: 'SoundCloud Track 2',
      author: 'SoundCloud Artist',
      duration: 195000,
      identifier: 'sc-2',
      isSeekable: true,
      isStream: false,
      uri: 'https://soundcloud.com/artist/track-2',
    },
  };

  const rawTrack3 = {
    encoded: 'track3-encoded',
    info: {
      title: 'SoundCloud Track 3',
      author: 'SoundCloud Artist',
      duration: 240000,
      identifier: 'sc-3',
      isSeekable: true,
      isStream: false,
    },
  };

  function createMockManager(searchResult: unknown) {
    const node = {
      search: vi.fn().mockResolvedValue(searchResult),
    };
    const manager = {
      nodeManager: {
        leastUsedNodes: vi.fn(() => [node]),
      },
    } as unknown as LavalinkManager;

    return { manager, node };
  }

  describe('capabilities', () => {
    it('declares search, resolveTrackUrl, and resolvePlaylistUrl capabilities', () => {
      const { manager } = createMockManager(null);
      const provider = new LavalinkProvider({ manager });

      expect(provider.capabilities.has('search')).toBe(true);
      expect(provider.capabilities.has('resolveTrackUrl')).toBe(true);
      expect(provider.capabilities.has('resolvePlaylistUrl')).toBe(true);
    });
  });

  describe('searchTracks', () => {
    it('returns empty array when loadType is empty', async () => {
      const { manager } = createMockManager({ loadType: 'empty', data: [] });
      const provider = new LavalinkProvider({ manager });

      const tracks = await provider.searchTracks('query');
      expect(tracks).toEqual([]);
    });

    it('returns normalized tracks capped by limit', async () => {
      const { manager } = createMockManager({
        loadType: 'search',
        data: [rawTrack1, rawTrack2, rawTrack3],
      });
      const provider = new LavalinkProvider({ manager });

      const tracks = await provider.searchTracks('query', 2);
      expect(tracks).toHaveLength(2);
      expect(tracks[0]?.title).toBe('SoundCloud Track 1');
      expect(tracks[1]?.title).toBe('SoundCloud Track 2');
    });
  });

  describe('resolveTrackUrl', () => {
    it('resolves and normalizes single track URL', async () => {
      const { manager, node } = createMockManager({
        loadType: 'track',
        data: [rawTrack1],
      });
      const provider = new LavalinkProvider({ manager });

      const track = await provider.resolveTrackUrl(
        new URL('https://soundcloud.com/artist/track-1'),
      );
      expect(track.title).toBe('SoundCloud Track 1');
      expect(track.encoded).toBe('track1-encoded');
      expect(node.search).toHaveBeenCalledWith(
        { query: 'https://soundcloud.com/artist/track-1', source: 'link' },
        null,
      );
    });

    it('throws trackUnavailable if track is not found', async () => {
      const { manager } = createMockManager({ loadType: 'empty', data: [] });
      const provider = new LavalinkProvider({ manager });

      await expect(
        provider.resolveTrackUrl(new URL('https://soundcloud.com/artist/missing')),
      ).rejects.toThrow(RifflyError);
    });
  });

  describe('resolvePlaylistUrl', () => {
    it('resolves playlist with playlist info and tracks', async () => {
      const { manager } = createMockManager({
        loadType: 'playlist',
        playlist: {
          name: 'Awesome Set',
          title: 'Awesome Set',
        },
        tracks: [rawTrack1, rawTrack2, rawTrack3],
      });
      const provider = new LavalinkProvider({ manager });

      const res = await provider.resolvePlaylistUrl(
        new URL('https://soundcloud.com/artist/sets/awesome-set'),
        2,
      );

      expect(res.title).toBe('Awesome Set');
      expect(res.tracks).toHaveLength(2);
      expect(res.totalItems).toBe(3);
      expect(res.skipped).toBe(1);
      expect(res.tracks[0]?.title).toBe('SoundCloud Track 1');
      expect(res.tracks[1]?.title).toBe('SoundCloud Track 2');
    });

    it('extracts playlist title from data.info when playlist object is absent', async () => {
      const { manager } = createMockManager({
        loadType: 'playlist',
        data: {
          info: { name: 'Raw Info Set Name' },
          tracks: [rawTrack1],
        },
      });
      const provider = new LavalinkProvider({ manager });

      const res = await provider.resolvePlaylistUrl(
        new URL('https://soundcloud.com/artist/sets/raw-set'),
        50,
      );

      expect(res.title).toBe('Raw Info Set Name');
      expect(res.tracks).toHaveLength(1);
      expect(res.totalItems).toBe(1);
      expect(res.skipped).toBe(0);
    });

    it('delegates to node.loadTracks when available on node', async () => {
      const loadTracksMock = vi.fn().mockResolvedValue({
        loadType: 'playlist',
        playlist: { title: 'Loaded Via loadTracks' },
        tracks: [rawTrack1],
      });
      const node = {
        loadTracks: loadTracksMock,
        search: vi.fn(),
      };
      const manager = {
        nodeManager: {
          leastUsedNodes: vi.fn(() => [node]),
        },
      } as unknown as LavalinkManager;

      const provider = new LavalinkProvider({ manager });
      const res = await provider.resolvePlaylistUrl(
        new URL('https://soundcloud.com/artist/sets/test'),
      );

      expect(loadTracksMock).toHaveBeenCalledWith('https://soundcloud.com/artist/sets/test');
      expect(res.title).toBe('Loaded Via loadTracks');
      expect(res.tracks).toHaveLength(1);
    });

    it('throws noResults when playlist is empty', async () => {
      const { manager } = createMockManager({
        loadType: 'empty',
        tracks: [],
      });
      const provider = new LavalinkProvider({ manager });

      await expect(
        provider.resolvePlaylistUrl(new URL('https://soundcloud.com/artist/sets/empty')),
      ).rejects.toThrow(RifflyError);
    });

    it('throws trackUnavailable when loadType is error', async () => {
      const { manager } = createMockManager({
        loadType: 'error',
        exception: { message: 'SoundCloud API rate limit' },
      });
      const provider = new LavalinkProvider({ manager });

      await expect(
        provider.resolvePlaylistUrl(new URL('https://soundcloud.com/artist/sets/rate-limited')),
      ).rejects.toThrow(RifflyError);
    });
  });

  describe('TrackResolver with LavalinkProvider for SoundCloud playlists', () => {
    it('resolves soundcloud playlist URL through TrackResolver', async () => {
      const { manager } = createMockManager({
        loadType: 'playlist',
        playlist: { title: 'Chill Vibes' },
        tracks: [rawTrack1, rawTrack2],
      });

      const registry = new ProviderRegistry();
      const lavalinkProvider = new LavalinkProvider({ manager });
      registry.register(lavalinkProvider, ['soundcloud.com']);

      const resolver = new TrackResolver({ registry, playlistItemLimit: 50 });
      const result = await resolver.resolve('https://soundcloud.com/artist/sets/chill-vibes');

      expect(result.tracks).toHaveLength(2);
      expect(result.summary).toBe('Playlist **Chill Vibes** — 2 tracks');
    });
  });
});
