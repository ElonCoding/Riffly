import type { Track } from '../audio/types.js';

export type RecommendationResolver = (lastTrack: Track) => Promise<Track | null>;

/**
 * Manages smart autoplay queue replenishment for guilds.
 */
export class AutoplayManager {
  private readonly enabledGuilds = new Set<string>();
  private readonly resolver: RecommendationResolver | undefined;

  constructor(resolver?: RecommendationResolver) {
    this.resolver = resolver;
  }

  /**
   * Checks whether autoplay is enabled for a given guild.
   */
  public isEnabled(guildId: string): boolean {
    return this.enabledGuilds.has(guildId);
  }

  /**
   * Sets autoplay enabled or disabled for a given guild.
   */
  public setEnabled(guildId: string, enabled: boolean): void {
    if (enabled) {
      this.enabledGuilds.add(guildId);
    } else {
      this.enabledGuilds.delete(guildId);
    }
  }

  /**
   * Toggles autoplay state for a guild and returns the new state.
   */
  public toggle(guildId: string): boolean {
    const newState = !this.isEnabled(guildId);
    this.setEnabled(guildId, newState);
    return newState;
  }

  /**
   * Resolves the next recommended track based on the finished track.
   */
  public async getRecommendation(lastTrack: Track): Promise<Track | null> {
    if (!this.resolver) {
      return null;
    }
    try {
      return await this.resolver(lastTrack);
    } catch (err: unknown) {
      console.warn(
        `[Autoplay] Failed resolving recommendation for "${lastTrack.title}":`,
        err instanceof Error ? err.message : String(err),
      );
      return null;
    }
  }
}
