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
 * Native audio track provider using play-dl and @distube/ytdl-core.
 * Directly resolves searches, YouTube links, and playlists without Lavalink.
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
}
