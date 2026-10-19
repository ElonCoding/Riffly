/**
 * Provider interface types.
 *
 * Providers expose capabilities through typed interfaces. A provider that
 * cannot perform search does not implement search methods — capability
 * declarations are not optional flags, they are interface membership.
 */

import type { Track } from '../audio/types.js';

/** Capabilities a provider may declare. */
export type ProviderCapability = 'search' | 'resolveTrackUrl' | 'resolvePlaylistUrl';

/** Resolved playlist with a hard item cap applied. */
export interface ResolvedPlaylist {
  readonly title: string;
  readonly tracks: readonly Track[];
  readonly totalItems: number; // may be > tracks.length when capped
  readonly skipped: number;
}

/** Provider that supports free-text search. */
export interface SearchableProvider {
  readonly id: string;
  readonly capabilities: ReadonlySet<ProviderCapability>;
  searchTracks(query: string, limit?: number): Promise<readonly Track[]>;
}

/** Provider that can resolve a single track URL. */
export interface TrackUrlProvider {
  readonly id: string;
  readonly capabilities: ReadonlySet<ProviderCapability>;
  resolveTrackUrl(url: URL): Promise<Track>;
}

/** Provider that can resolve playlist URLs. */
export interface PlaylistUrlProvider {
  readonly id: string;
  readonly capabilities: ReadonlySet<ProviderCapability>;
  resolvePlaylistUrl(url: URL, itemLimit: number): Promise<ResolvedPlaylist>;
}

/** Union of all provider shapes. */
export type MusicProvider = SearchableProvider | TrackUrlProvider | PlaylistUrlProvider;

/**
 * Hostname → provider ID mapping for exact-host allowlist routing.
 * Values must be registered provider IDs.
 */
export type HostnameAllowlist = ReadonlyMap<string, string>;
