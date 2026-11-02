import type {
  PlaylistUrlProvider,
  ProviderCapability,
  ResolvedPlaylist,
  SearchableProvider,
  TrackUrlProvider,
} from './types.js';
import type { Track } from '../audio/types.js';
import play from 'play-dl';
import { Ytdl } from '@distube/ytdl-core';
import { RifflyError } from '../errors.js';

/**
 * Native audio track provider using @distube/ytdl-core, Spotify oEmbed, Apple Music and play-dl.
 * Directly resolves searches, YouTube, Spotify, and Apple Music links and playlists.
 */
export class NativeProvider implements SearchableProvider, TrackUrlProvider, PlaylistUrlProvider {
  readonly id = 'native';
  readonly capabilities: ReadonlySet<ProviderCapability> = new Set<ProviderCapability>([
    'search',
    'resolveTrackUrl',
    'resolvePlaylistUrl',
  ]);
  private readonly ytdl = new Ytdl();

  async searchTracks(query: string, limit = 5): Promise<readonly Track[]> {
    try {
      const results = await this.ytdl.search(query, { limit });
      if (results && results.length > 0) {
        return results.map((item) => ({
          encoded: item.url,
          title: item.title ?? 'Unknown title',
          author: item.author?.name ?? 'Unknown artist',
          lengthMs: (item.lengthSeconds ?? 0) * 1000,
          identifier: item.id ?? item.url,
          isSeekable: true,
          isStream: Boolean(item.isLive),
          uri: item.url,
          ...(item.thumbnails?.[0]?.url ? { artworkUrl: item.thumbnails[0].url } : {}),
        }));
      }
    } catch (err) {
      console.warn('[NativeProvider] ytdl search notice:', err instanceof Error ? err.message : err);
    }

    try {
      const results = await play.search(query, { limit });
      return results.map((item) => ({
        encoded: item.url,
        title: item.title ?? 'Unknown title',
        author: item.channel?.name ?? 'Unknown artist',
        lengthMs: (item.durationInSec ?? 0) * 1000,
        identifier: item.id ?? item.url,
        isSeekable: true,
        isStream: false,
        uri: item.url,
        ...(item.thumbnails?.[0]?.url ? { artworkUrl: item.thumbnails[0].url } : {}),
      }));
    } catch {
      return [];
    }
  }

  async resolveTrackUrl(url: URL): Promise<Track> {
    const urlStr = url.toString();

    // 1. Spotify Track
    if (urlStr.includes('spotify.com')) {
      return this.resolveSpotifyTrack(urlStr);
    }

    // 2. Apple Music Track
    if (urlStr.includes('music.apple.com')) {
      return this.resolveAppleMusicTrack(url);
    }

    // 3. YouTube Video
    try {
      if (urlStr.includes('youtube.com') || urlStr.includes('youtu.be')) {
        const info = await this.ytdl.getInfo(urlStr);
        return {
          encoded: urlStr,
          title: info.videoDetails.title ?? 'Unknown title',
          author: info.videoDetails.author?.name ?? 'Unknown artist',
          lengthMs: (info.videoDetails.lengthSeconds ?? 0) * 1000,
          identifier: info.videoDetails.id ?? urlStr,
          isSeekable: true,
          isStream: Boolean(info.videoDetails.isLive),
          uri: urlStr,
          ...(info.videoDetails.thumbnails?.[0]?.url
            ? { artworkUrl: info.videoDetails.thumbnails[0].url }
            : {}),
        };
      }

      // Generic URL fallback
      const info = await play.video_basic_info(urlStr);
      return {
        encoded: urlStr,
        title: info.video_details.title ?? 'Unknown title',
        author: info.video_details.channel?.name ?? 'Unknown artist',
        lengthMs: (info.video_details.durationInSec ?? 0) * 1000,
        identifier: info.video_details.id ?? urlStr,
        isSeekable: true,
        isStream: false,
        uri: urlStr,
        ...(info.video_details.thumbnails?.[0]?.url
          ? { artworkUrl: info.video_details.thumbnails[0].url }
          : {}),
      };
    } catch (err) {
      throw RifflyError.trackUnavailable(err);
    }
  }

  async resolvePlaylistUrl(url: URL, itemLimit: number): Promise<ResolvedPlaylist> {
    const urlStr = url.toString();

    // 1. Spotify Playlist or Album
    if (urlStr.includes('spotify.com')) {
      return this.resolveSpotifyPlaylist(urlStr, itemLimit);
    }

    // 2. Apple Music Album or Playlist
    if (urlStr.includes('music.apple.com')) {
      return this.resolveAppleMusicPlaylist(url, itemLimit);
    }

    // 3. YouTube Playlist
    try {
      const pl = await play.playlist_info(urlStr, { incomplete: true });
      const videos = await pl.all_videos();
      const tracks: Track[] = videos.slice(0, itemLimit).map((v) => ({
        encoded: v.url,
        title: v.title ?? 'Unknown title',
        author: v.channel?.name ?? 'Unknown artist',
        lengthMs: (v.durationInSec ?? 0) * 1000,
        identifier: v.id ?? v.url,
        isSeekable: true,
        isStream: false,
        uri: v.url,
        ...(v.thumbnails?.[0]?.url ? { artworkUrl: v.thumbnails[0].url } : {}),
      }));

      return {
        title: pl.title ?? 'Playlist',
        tracks,
        totalItems: videos.length,
        skipped: Math.max(0, videos.length - tracks.length),
      };
    } catch (err) {
      throw RifflyError.trackUnavailable(err);
    }
  }

  private async resolveSpotifyTrack(urlStr: string): Promise<Track> {
    const id = urlStr.split('/track/')[1]?.split('?')[0] || '';
    let title = 'Spotify Track';
    let artist = 'Unknown Artist';
    let artworkUrl: string | undefined;
    let durationMs = 180000;

    try {
      const oembedRes = await fetch(
        `https://open.spotify.com/oembed?url=${encodeURIComponent(urlStr)}`,
      );
      if (oembedRes.ok) {
        const oembed = (await oembedRes.json()) as { title?: string; thumbnail_url?: string };
        if (oembed.title) title = oembed.title;
        if (oembed.thumbnail_url) artworkUrl = oembed.thumbnail_url;
      }
    } catch {}

    try {
      const embedRes = await fetch(`https://open.spotify.com/embed/track/${id}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      if (embedRes.ok) {
        const embedHtml = await embedRes.text();
        const nextDataMatch = embedHtml.match(
          /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
        );
        if (nextDataMatch && nextDataMatch[1]) {
          const nextData = JSON.parse(nextDataMatch[1]) as {
            props?: { state?: { data?: { entity?: { subtitle?: string; duration?: number } } } };
          };
          const entity = nextData.props?.state?.data?.entity;
          if (entity?.subtitle) artist = entity.subtitle;
          if (entity?.duration) durationMs = entity.duration;
        }
      }
    } catch {}

    // Match best YouTube stream
    let playUri = urlStr;
    try {
      const ytMatches = await this.ytdl.search(`${artist} - ${title}`, { limit: 1 });
      if (ytMatches && ytMatches[0]?.url) {
        playUri = ytMatches[0].url;
      }
    } catch {}

    return {
      encoded: playUri,
      title,
      author: artist,
      lengthMs: durationMs,
      identifier: playUri,
      isSeekable: true,
      isStream: false,
      uri: playUri,
      ...(artworkUrl ? { artworkUrl } : {}),
    };
  }

  private async resolveSpotifyPlaylist(urlStr: string, itemLimit: number): Promise<ResolvedPlaylist> {
    const isAlbum = urlStr.includes('/album/');
    const type = isAlbum ? 'album' : 'playlist';
    const id = urlStr.split(`/${type}/`)[1]?.split('?')[0] || '';

    try {
      const embedRes = await fetch(`https://open.spotify.com/embed/${type}/${id}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      if (!embedRes.ok) {
        throw new Error(`Spotify embed returned ${embedRes.status}`);
      }
      const embedHtml = await embedRes.text();
      const nextDataMatch = embedHtml.match(
        /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
      );
      if (!nextDataMatch || !nextDataMatch[1]) {
        throw new Error('Failed to parse Spotify embed metadata');
      }

      interface SpotifyEntity {
        name?: string;
        trackList?: Array<{ title?: string; subtitle?: string; duration?: number }>;
      }
      const nextData = JSON.parse(nextDataMatch[1]) as {
        props?: { pageProps?: { state?: { data?: { entity?: SpotifyEntity } } } };
      };
      const entity = nextData.props?.pageProps?.state?.data?.entity;
      const rawTracks = entity?.trackList || [];
      const playlistTitle = entity?.name || (isAlbum ? 'Spotify Album' : 'Spotify Playlist');

      const tracks: Track[] = rawTracks.slice(0, itemLimit).map((t) => {
        const title = t.title || 'Unknown title';
        const author = t.subtitle || 'Unknown artist';
        const query = `ytsearch:${author} - ${title}`;
        return {
          encoded: query,
          title,
          author,
          lengthMs: t.duration || 180000,
          identifier: query,
          isSeekable: true,
          isStream: false,
          uri: query,
        };
      });

      return {
        title: playlistTitle,
        tracks,
        totalItems: rawTracks.length,
        skipped: Math.max(0, rawTracks.length - tracks.length),
      };
    } catch (err) {
      throw RifflyError.trackUnavailable(err);
    }
  }

  private async resolveAppleMusicTrack(url: URL): Promise<Track> {
    const urlStr = url.toString();
    const trackI = url.searchParams.get('i');
    const collectionIdMatch = urlStr.match(/\/album\/[^/]+\/(\d+)/);
    const collectionId = collectionIdMatch ? collectionIdMatch[1] : null;

    let title = 'Apple Music Track';
    let artist = 'Unknown Artist';
    let artworkUrl: string | undefined;
    let durationMs = 180000;

    if (collectionId) {
      try {
        const itunesRes = await fetch(
          `https://itunes.apple.com/lookup?id=${collectionId}&entity=song`,
        );
        if (itunesRes.ok) {
          interface ItunesSong {
            wrapperType?: string;
            trackId?: number;
            trackName?: string;
            artistName?: string;
            trackTimeMillis?: number;
            artworkUrl100?: string;
          }
          const data = (await itunesRes.json()) as { results?: ItunesSong[] };
          const songs = data.results?.filter((r) => r.wrapperType === 'track') || [];
          const matched =
            (trackI ? songs.find((s) => String(s.trackId) === trackI) : undefined) || songs[0];
          if (matched) {
            if (matched.trackName) title = matched.trackName;
            if (matched.artistName) artist = matched.artistName;
            if (matched.trackTimeMillis) durationMs = matched.trackTimeMillis;
            if (matched.artworkUrl100) {
              artworkUrl = matched.artworkUrl100.replace('100x100bb', '600x600bb');
            }
          }
        }
      } catch {}
    }

    let playUri = urlStr;
    try {
      const ytMatches = await this.ytdl.search(`${artist} - ${title}`, { limit: 1 });
      if (ytMatches && ytMatches[0]?.url) {
        playUri = ytMatches[0].url;
      }
    } catch {}

    return {
      encoded: playUri,
      title,
      author: artist,
      lengthMs: durationMs,
      identifier: playUri,
      isSeekable: true,
      isStream: false,
      uri: playUri,
      ...(artworkUrl ? { artworkUrl } : {}),
    };
  }

  private async resolveAppleMusicPlaylist(
    url: URL,
    itemLimit: number,
  ): Promise<ResolvedPlaylist> {
    const urlStr = url.toString();
    const collectionIdMatch = urlStr.match(/\/album\/[^/]+\/(\d+)/);
    const collectionId = collectionIdMatch ? collectionIdMatch[1] : null;

    if (!collectionId) {
      throw RifflyError.invalidInput('Could not extract Apple Music album/playlist ID.');
    }

    try {
      const itunesRes = await fetch(
        `https://itunes.apple.com/lookup?id=${collectionId}&entity=song`,
      );
      if (!itunesRes.ok) {
        throw new Error(`iTunes API returned ${itunesRes.status}`);
      }

      interface ItunesSong {
        wrapperType?: string;
        collectionName?: string;
        trackId?: number;
        trackName?: string;
        artistName?: string;
        trackTimeMillis?: number;
        artworkUrl100?: string;
      }
      const data = (await itunesRes.json()) as { results?: ItunesSong[] };
      const rawTracks = data.results?.filter((r) => r.wrapperType === 'track') || [];
      const collectionTitle = data.results?.[0]?.collectionName || 'Apple Music Collection';

      const tracks: Track[] = rawTracks.slice(0, itemLimit).map((s) => {
        const title = s.trackName || 'Unknown title';
        const author = s.artistName || 'Unknown artist';
        const query = `ytsearch:${author} - ${title}`;
        return {
          encoded: query,
          title,
          author,
          lengthMs: s.trackTimeMillis || 180000,
          identifier: query,
          isSeekable: true,
          isStream: false,
          uri: query,
          ...(s.artworkUrl100
            ? { artworkUrl: s.artworkUrl100.replace('100x100bb', '600x600bb') }
            : {}),
        };
      });

      return {
        title: collectionTitle,
        tracks,
        totalItems: rawTracks.length,
        skipped: Math.max(0, rawTracks.length - tracks.length),
      };
    } catch (err) {
      throw RifflyError.trackUnavailable(err);
    }
  }
}
