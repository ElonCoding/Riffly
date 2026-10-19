/**
 * Provider registry.
 *
 * Central store for registered music providers. Providers declare their
 * capabilities and are dispatched by the resolver based on classified input.
 */

import { RifflyError } from '../errors.js';
import type {
  HostnameAllowlist,
  MusicProvider,
  PlaylistUrlProvider,
  SearchableProvider,
  TrackUrlProvider,
} from './types.js';

export class ProviderRegistry {
  private readonly providers = new Map<string, MusicProvider>();
  private readonly hostnameMap = new Map<string, string>(); // hostname → providerId

  /**
   * Register a provider. The provider's declared hostnames are added to the
   * exact-host allowlist.
   */
  register(provider: MusicProvider, hostnames: readonly string[] = []): this {
    this.providers.set(provider.id, provider);
    for (const host of hostnames) {
      this.hostnameMap.set(host.toLowerCase(), provider.id);
    }
    return this;
  }

  /** Hostname allowlist suitable for the input classifier. */
  get allowlist(): HostnameAllowlist {
    return this.hostnameMap;
  }

  /** Resolve a provider by ID, throwing RifflyError if not found. */
  get(id: string): MusicProvider {
    const provider = this.providers.get(id);
    if (!provider) {
      throw RifflyError.internal(new Error(`Unknown provider ID: ${id}`));
    }
    return provider;
  }

  /** Return the first registered provider that supports free-text search. */
  getSearchProvider(): SearchableProvider | undefined {
    for (const provider of this.providers.values()) {
      if (provider.capabilities.has('search') && isSearchable(provider)) {
        return provider;
      }
    }
    return undefined;
  }

  /** Return a track-URL-capable provider by ID, or undefined. */
  getTrackUrlProvider(id: string): TrackUrlProvider | undefined {
    const provider = this.providers.get(id);
    if (provider && provider.capabilities.has('resolveTrackUrl') && isTrackUrlProvider(provider)) {
      return provider;
    }
    return undefined;
  }

  /** Return a playlist-capable provider by ID, or undefined. */
  getPlaylistProvider(id: string): PlaylistUrlProvider | undefined {
    const provider = this.providers.get(id);
    if (
      provider &&
      provider.capabilities.has('resolvePlaylistUrl') &&
      isPlaylistProvider(provider)
    ) {
      return provider;
    }
    return undefined;
  }
}

function isSearchable(p: MusicProvider): p is SearchableProvider {
  return typeof (p as SearchableProvider).searchTracks === 'function';
}

function isTrackUrlProvider(p: MusicProvider): p is TrackUrlProvider {
  return typeof (p as TrackUrlProvider).resolveTrackUrl === 'function';
}

function isPlaylistProvider(p: MusicProvider): p is PlaylistUrlProvider {
  return typeof (p as PlaylistUrlProvider).resolvePlaylistUrl === 'function';
}
