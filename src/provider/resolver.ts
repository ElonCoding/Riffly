/**
 * Track resolver.
 *
 * Orchestrates input classification → provider dispatch → Track resolution.
 * Uses the provider registry and hostname allowlist.
 */

import { classifyInput } from './classifier.js';
import type { ProviderRegistry } from './registry.js';
import type { Track } from '../audio/types.js';
import { RifflyError } from '../errors.js';

export interface ResolverOptions {
  readonly registry: ProviderRegistry;
  /** Hostnames whose paths may indicate playlists. */
  readonly playlistHosts?: ReadonlySet<string>;
  readonly playlistItemLimit?: number;
  readonly searchResultLimit?: number;
}

export interface ResolveResult {
  /** Tracks to enqueue. Single track → array of 1. */
  readonly tracks: readonly Track[];
  /** Human-readable summary of what was resolved. */
  readonly summary: string;
}

export class TrackResolver {
  private readonly registry: ProviderRegistry;
  private readonly playlistHosts: ReadonlySet<string>;
  private readonly playlistItemLimit: number;
  private readonly searchResultLimit: number;

  constructor(options: ResolverOptions) {
    this.registry = options.registry;
    this.playlistHosts = options.playlistHosts ?? new Set();
    this.playlistItemLimit = options.playlistItemLimit ?? 50;
    this.searchResultLimit = options.searchResultLimit ?? 1;
  }

  async resolve(raw: string): Promise<ResolveResult> {
    const classified = classifyInput(raw, this.registry.allowlist, this.playlistHosts);
    if (!classified.ok) {
      throw classified.error;
    }

    const { input } = classified;

    if (input.kind === 'search') {
      const provider = this.registry.getSearchProvider();
      if (!provider) {
        throw new RifflyError(
          'UnsupportedProvider',
          '❌ No search provider is configured.',
        );
      }
      const tracks = await provider.searchTracks(input.query, this.searchResultLimit);
      if (tracks.length === 0) {
        throw RifflyError.noResults(input.query);
      }
      const track = tracks[0]!;
      return {
        tracks: [track],
        summary: `**${track.title}** by ${track.author}`,
      };
    }

    if (input.kind === 'track-url') {
      const provider = this.registry.getTrackUrlProvider(input.providerId);
      if (!provider) {
        throw RifflyError.unsupportedProvider(input.url.hostname);
      }
      const track = await provider.resolveTrackUrl(input.url);
      return {
        tracks: [track],
        summary: `**${track.title}** by ${track.author}`,
      };
    }

    // playlist-url
    const provider = this.registry.getPlaylistProvider(input.providerId);
    if (!provider) {
      throw RifflyError.unsupportedProvider(input.url.hostname);
    }
    const playlist = await provider.resolvePlaylistUrl(input.url, this.playlistItemLimit);
    if (playlist.tracks.length === 0) {
      throw RifflyError.noResults(input.url.toString());
    }
    const skippedNote = playlist.skipped > 0 ? ` (${playlist.skipped} unavailable skipped)` : '';
    return {
      tracks: playlist.tracks,
      summary: `Playlist **${playlist.title}** — ${playlist.tracks.length} tracks${skippedNote}`,
    };
  }
}
