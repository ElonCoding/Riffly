import { describe, expect, it, vi } from 'vitest';
import {
  applyFilterPreset,
  BASSBOOST_EQUALIZER,
  type PlayerWithFilters,
} from '../../src/audio/filters.js';

describe('AudioFilters', () => {
  function createMockFilterManager() {
    const resetFiltersMock = vi.fn().mockResolvedValue(true);
    const setEqualizerMock = vi.fn().mockResolvedValue(true);
    const setTimescaleMock = vi.fn().mockResolvedValue(true);
    const setRotationMock = vi.fn().mockResolvedValue(true);
    const setTremoloMock = vi.fn().mockResolvedValue(true);
    const setKaraokeMock = vi.fn().mockResolvedValue(true);

    const fm = {
      resetFilters: resetFiltersMock,
      setEqualizer: setEqualizerMock,
      setTimescale: setTimescaleMock,
      setRotation: setRotationMock,
      setTremolo: setTremoloMock,
      setKaraoke: setKaraokeMock,
    };

    return {
      fm,
      resetFiltersMock,
      setEqualizerMock,
      setTimescaleMock,
      setRotationMock,
      setTremoloMock,
      setKaraokeMock,
    };
  }

  it('resets and applies bassboost equalizer preset', async () => {
    const { fm, resetFiltersMock, setEqualizerMock } = createMockFilterManager();
    const player: PlayerWithFilters = { filterManager: fm };

    await applyFilterPreset(player, 'bassboost');
    expect(resetFiltersMock).toHaveBeenCalled();
    expect(setEqualizerMock).toHaveBeenCalledWith(BASSBOOST_EQUALIZER);
  });

  it('applies nightcore timescale preset', async () => {
    const { fm, resetFiltersMock, setTimescaleMock } = createMockFilterManager();
    const player: PlayerWithFilters = { filterManager: fm };

    await applyFilterPreset(player, 'nightcore');
    expect(resetFiltersMock).toHaveBeenCalled();
    expect(setTimescaleMock).toHaveBeenCalledWith({ speed: 1.25, pitch: 1.25, rate: 1.0 });
  });

  it('applies vaporwave timescale preset', async () => {
    const { fm, resetFiltersMock, setTimescaleMock } = createMockFilterManager();
    const player: PlayerWithFilters = { filterManager: fm };

    await applyFilterPreset(player, 'vaporwave');
    expect(resetFiltersMock).toHaveBeenCalled();
    expect(setTimescaleMock).toHaveBeenCalledWith({ speed: 0.85, pitch: 0.8, rate: 1.0 });
  });

  it('applies 8D audio rotation preset', async () => {
    const { fm, resetFiltersMock, setRotationMock } = createMockFilterManager();
    const player: PlayerWithFilters = { filterManager: fm };

    await applyFilterPreset(player, '8d');
    expect(resetFiltersMock).toHaveBeenCalled();
    expect(setRotationMock).toHaveBeenCalledWith({ rotationHz: 0.2 });
  });

  it('clears all audio filters', async () => {
    const { fm, resetFiltersMock, setTimescaleMock, setEqualizerMock } = createMockFilterManager();
    const player: PlayerWithFilters = { filterManager: fm };

    await applyFilterPreset(player, 'clear');
    expect(resetFiltersMock).toHaveBeenCalled();
    expect(setTimescaleMock).not.toHaveBeenCalled();
    expect(setEqualizerMock).not.toHaveBeenCalled();
  });

  it('handles player without filter manager gracefully', async () => {
    await expect(applyFilterPreset(null, 'bassboost')).resolves.toBeUndefined();
    await expect(applyFilterPreset({}, 'bassboost')).resolves.toBeUndefined();
  });
});
