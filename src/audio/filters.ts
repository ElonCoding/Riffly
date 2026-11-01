/**
 * Supported DSP audio filter presets.
 */
export type AudioFilterPreset =
  | 'bassboost'
  | 'nightcore'
  | 'vaporwave'
  | '8d'
  | 'tremolo'
  | 'karaoke'
  | 'clear';

export interface EqualizerBand {
  band: number;
  gain: number;
}

export const BASSBOOST_EQUALIZER: EqualizerBand[] = [
  { band: 0, gain: 0.3 },
  { band: 1, gain: 0.25 },
  { band: 2, gain: 0.2 },
  { band: 3, gain: 0.15 },
  { band: 4, gain: 0.05 },
  { band: 5, gain: -0.05 },
  { band: 6, gain: -0.05 },
  { band: 7, gain: 0.0 },
  { band: 8, gain: 0.0 },
  { band: 9, gain: 0.0 },
  { band: 10, gain: 0.0 },
  { band: 11, gain: 0.0 },
  { band: 12, gain: 0.0 },
  { band: 13, gain: 0.0 },
  { band: 14, gain: 0.0 },
];

export interface FilterManagerLike {
  resetFilters(): Promise<unknown>;
  setEqualizer(bands: EqualizerBand[]): Promise<unknown>;
  setTimescale(options: { speed?: number; pitch?: number; rate?: number }): Promise<unknown>;
  setRotation(options: { rotationHz: number }): Promise<unknown>;
  setTremolo(options: { frequency: number; depth: number }): Promise<unknown>;
  setKaraoke(options: {
    level: number;
    monoLevel: number;
    filterBand: number;
    filterWidth: number;
  }): Promise<unknown>;
}

export interface PlayerWithFilters {
  filterManager?: FilterManagerLike;
  filters?: FilterManagerLike;
}

/**
 * Applies a given DSP preset to a Lavalink player instance.
 */
export async function applyFilterPreset(
  player: PlayerWithFilters | null | undefined,
  preset: AudioFilterPreset,
): Promise<void> {
  const fm = player?.filterManager ?? player?.filters;
  if (!fm) return;

  await fm.resetFilters();

  switch (preset) {
    case 'bassboost':
      await fm.setEqualizer(BASSBOOST_EQUALIZER);
      break;
    case 'nightcore':
      await fm.setTimescale({ speed: 1.25, pitch: 1.25, rate: 1.0 });
      break;
    case 'vaporwave':
      await fm.setTimescale({ speed: 0.85, pitch: 0.8, rate: 1.0 });
      break;
    case '8d':
      await fm.setRotation({ rotationHz: 0.2 });
      break;
    case 'tremolo':
      await fm.setTremolo({ frequency: 2.0, depth: 0.5 });
      break;
    case 'karaoke':
      await fm.setKaraoke({ level: 1.0, monoLevel: 1.0, filterBand: 220, filterWidth: 100 });
      break;
    case 'clear':
      // Reset is already called above
      break;
  }
}
