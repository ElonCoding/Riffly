/**
 * Lavalink built-in source provider.
 *
 * Delegates search and direct-URL resolution to the Lavalink node's built-in
 * source managers via node.search(). No external REST client needed.
 *
 * Default search source: SoundCloud (scsearch) — open platform, legal for bots.
 * YouTube search can be added via ytmsearch/ytsearch after reviewing terms.
 */

import type { LavalinkManager, SearchPlatform } from 'lavalink-client';
import { RifflyError } from '../errors.js';
import type { Track } from '../audio/types.js';
import type {
  PlaylistUrlProvider,
  ProviderCapability,
  ResolvedPlaylist,
  SearchableProvider,
  TrackUrlProvider,
} from './types.js';

export interface LavalinkProviderOptions {
  readonly manager: LavalinkManager;
  /** Search source prefix as SearchPlatform. Default 'scsearch'. */
  readonly searchSource?: SearchPlatform;
}

// Shape of what node.search() resolves to
interface SearchResult {
  loadType?: string;
  tracks?: RawTrack[];
  data?:
    | RawTrack[]
    | RawTrack
    | {
        tracks?: RawTrack[];
        info?: { name?: string; title?: string };
        pluginInfo?: { name?: string; title?: string };
      };
  playlist?: {
    name?: string | null;
    title?: string | null;
    author?: string | null;
  } | null;
  exception?: { message?: string };
}

interface RawTrack {
  encoded?: string | null;
  info?: {
    title?: string | null;
    author?: string | null;
    duration?: number | null;
    identifier?: string | null;
    isSeekable?: boolean | null;
    isStream?: boolean | null;
    uri?: string | null;
    artworkUrl?: string | null;
  } | null;
}

function normalizeRaw(raw: unknown): Track | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as RawTrack;
  const uri = r.info?.uri;
  const artworkUrl = r.info?.artworkUrl;
  return {
    encoded: r.encoded ?? '',
    title: r.info?.title ?? 'Unknown title',
    author: r.info?.author ?? 'Unknown artist',
    lengthMs: r.info?.duration ?? 0,
    identifier: r.info?.identifier ?? '',
    isSeekable: Boolean(r.info?.isSeekable),
    isStream: Boolean(r.info?.isStream),
    ...(typeof uri === 'string' && uri.length > 0 ? { uri } : {}),
    ...(typeof artworkUrl === 'string' && artworkUrl.length > 0 ? { artworkUrl } : {}),
  };
}

function extractTracks(result: SearchResult): RawTrack[] {
  // If lavalink-client populated tracks array
  if (Array.isArray(result.tracks) && result.tracks.length > 0) return result.tracks;
  // loadType = 'search' or 'track' → v4 API shape
  if (Array.isArray(result.data)) return result.data;
  if (result.data && typeof result.data === 'object' && !Array.isArray(result.data)) {
    const d = result.data as { tracks?: RawTrack[] };
    if (Array.isArray(d.tracks)) return d.tracks;
  }
  // Fallback to tracks array
  if (Array.isArray(result.tracks)) return result.tracks;
  return [];
}

export class LavalinkProvider implements SearchableProvider, TrackUrlProvider, PlaylistUrlProvider {
  readonly id = 'lavalink';
  readonly capabilities: ReadonlySet<ProviderCapability> = new Set<ProviderCapability>([
    'search',
    'resolveTrackUrl',
    'resolvePlaylistUrl',
  ]);

  private readonly manager: LavalinkManager;
  private readonly searchSource: SearchPlatform;

  constructor(options: LavalinkProviderOptions) {
    this.manager = options.manager;
    this.searchSource = options.searchSource ?? 'scsearch';
  }

  private getNode() {
    const nodes = this.manager.nodeManager.leastUsedNodes();
    return nodes.length > 0 ? nodes[0] : undefined;
  }

  async searchTracks(query: string, limit = 5): Promise<readonly Track[]> {
    const node = this.getNode();
    if (!node) throw RifflyError.lavalinkUnavailable();

    let result: SearchResult;
    try {
      // node.search accepts { query, source } or a plain string
      result = (await node.search({ query, source: this.searchSource }, null)) as SearchResult;
    } catch (cause) {
      throw new RifflyError(
        'ProviderUnavailable',
        '🔧 Search failed. Try again in a moment.',
        cause,
      );
    }

    if (!result || result.loadType === 'error' || result.loadType === 'empty') {
      return [];
    }

    return extractTracks(result)
      .slice(0, limit)
      .map(normalizeRaw)
      .filter((t): t is Track => t !== undefined);
  }

  async resolveTrackUrl(url: URL): Promise<Track> {
    const node = this.getNode();
    if (!node) throw RifflyError.lavalinkUnavailable();

    let result: SearchResult;
    try {
      result = (await node.search({ query: url.toString(), source: 'link' }, null)) as SearchResult;
    } catch (cause) {
      throw RifflyError.trackUnavailable(cause);
    }

    if (!result || result.loadType === 'error' || result.loadType === 'empty') {
      throw RifflyError.trackUnavailable();
    }

    const tracks = extractTracks(result);
    const track = normalizeRaw(tracks[0]);
    if (!track) throw RifflyError.trackUnavailable();
    return track;
  }

  async resolvePlaylistUrl(url: URL, itemLimit = 50): Promise<ResolvedPlaylist> {
    const node = this.getNode();
    if (!node) throw RifflyError.lavalinkUnavailable();

    let result: SearchResult;
    try {
      const managerWithLoad = this.manager as unknown as {
        loadTracks?: (identifier: string) => Promise<SearchResult>;
      };
      const nodeWithLoad = node as unknown as {
        loadTracks?: (identifier: string) => Promise<SearchResult>;
      };

      if (typeof managerWithLoad.loadTracks === 'function') {
        result = await managerWithLoad.loadTracks(url.toString());
      } else if (typeof nodeWithLoad.loadTracks === 'function') {
        result = await nodeWithLoad.loadTracks(url.toString());
      } else {
        result = (await node.search(
          { query: url.toString(), source: 'link' },
          null,
        )) as SearchResult;
      }
    } catch (cause) {
      throw RifflyError.trackUnavailable(cause);
    }

    if (!result || result.loadType === 'empty') {
      throw RifflyError.noResults(url.toString());
    }

    if (result.loadType === 'error') {
      const msg = result.exception?.message;
      throw RifflyError.trackUnavailable(msg ? new Error(msg) : undefined);
    }

    let title = 'Playlist';
    if (result.playlist?.title) {
      title = result.playlist.title;
    } else if (result.playlist?.name) {
      title = result.playlist.name;
    } else if (result.data && typeof result.data === 'object' && !Array.isArray(result.data)) {
      const dataObj = result.data as {
        info?: { name?: string; title?: string };
        pluginInfo?: { name?: string; title?: string };
      };
      title =
        dataObj.info?.title ??
        dataObj.info?.name ??
        dataObj.pluginInfo?.title ??
        dataObj.pluginInfo?.name ??
        title;
    }

    const rawTracks = extractTracks(result);
    if (rawTracks.length === 0) {
      throw RifflyError.noResults(url.toString());
    }

    const totalItems = rawTracks.length;
    const cappedRaw = rawTracks.slice(0, itemLimit);
    const tracks: Track[] = [];
    let skipped = totalItems - cappedRaw.length;

    for (const raw of cappedRaw) {
      const normalized = normalizeRaw(raw);
      if (normalized) {
        tracks.push(normalized);
      } else {
        skipped++;
      }
    }

    if (tracks.length === 0) {
      throw RifflyError.noResults(url.toString());
    }

    return {
      title,
      tracks,
      totalItems,
      skipped,
    };
  }
}
