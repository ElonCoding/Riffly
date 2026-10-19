/**
 * Input classifier.
 *
 * Distinguishes free-text search queries from provider-specific URLs.
 * All URL validation follows MUSIC_PIPELINE.md rules:
 *   - HTTP(S) only.
 *   - No embedded credentials.
 *   - Exact hostname match against the allowlist.
 *   - Returns a typed result; never throws.
 */

import { RifflyError } from '../errors.js';
import type { HostnameAllowlist } from './types.js';

export type ClassifiedInput =
  | { readonly kind: 'search'; readonly query: string }
  | { readonly kind: 'track-url'; readonly url: URL; readonly providerId: string }
  | { readonly kind: 'playlist-url'; readonly url: URL; readonly providerId: string };

export type ClassifyResult =
  | { readonly ok: true; readonly input: ClassifiedInput }
  | { readonly ok: false; readonly error: RifflyError };

/** Patterns that look enough like a URL that we should try to parse them. */
const URL_PATTERN = /^[a-z][a-z0-9+\-.]*:\/\//i;

/**
 * Classify trimmed, validated input into a search query or provider URL.
 *
 * @param raw - Already validated (non-empty, length-bounded, no control chars) input string.
 * @param allowlist - Exact hostname → providerId mapping.
 * @param playlistHosts - Set of hostnames whose paths indicate playlist resources.
 */
export function classifyInput(
  raw: string,
  allowlist: HostnameAllowlist,
  playlistHosts: ReadonlySet<string> = new Set(),
): ClassifyResult {
  if (!URL_PATTERN.test(raw)) {
    // Not a URL-like string — treat as a free-text search query.
    return { ok: true, input: { kind: 'search', query: raw } };
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return {
      ok: false,
      error: RifflyError.invalidInput('Malformed URL — could not be parsed.'),
    };
  }

  // Only HTTP(S) is allowed; reject ftp://, file://, etc.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return {
      ok: false,
      error: RifflyError.invalidInput('Only http:// and https:// URLs are supported.'),
    };
  }

  // Reject credentials embedded in the URL (user:password@host).
  if (url.username.length > 0 || url.password.length > 0) {
    return {
      ok: false,
      error: RifflyError.invalidInput('URLs must not contain embedded credentials.'),
    };
  }

  const hostname = url.hostname.toLowerCase();
  const providerId = allowlist.get(hostname);
  if (!providerId) {
    return {
      ok: false,
      error: RifflyError.unsupportedProvider(hostname),
    };
  }

  const isPlaylist = playlistHosts.has(hostname) || isPlaylistPath(url.pathname, url.searchParams);
  const kind = isPlaylist ? 'playlist-url' : 'track-url';

  return { ok: true, input: { kind, url, providerId } };
}

/** Heuristic: common playlist path indicators across providers. */
function isPlaylistPath(pathname: string, params: URLSearchParams): boolean {
  return (
    pathname.includes('/playlist') ||
    pathname.includes('/album') ||
    pathname.includes('/sets') ||
    params.has('list') // YouTube ?list=...
  );
}
