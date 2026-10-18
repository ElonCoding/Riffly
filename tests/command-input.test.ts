import { describe, expect, it } from 'vitest';
import { MAX_PLAY_INPUT_LENGTH, validatePlayInput } from '../src/commands/input.js';

describe('validatePlayInput', () => {
  it('accepts a plain search query and trims it', () => {
    expect(validatePlayInput('  daft punk one more time  ')).toEqual({
      ok: true,
      value: 'daft punk one more time',
    });
  });

  it('rejects empty and whitespace-only input', () => {
    expect(validatePlayInput('')).toEqual({ ok: false, problem: 'empty' });
    expect(validatePlayInput('   \t  ')).toEqual({ ok: false, problem: 'empty' });
  });

  it('rejects input over the configured length', () => {
    const tooLong = 'a'.repeat(MAX_PLAY_INPUT_LENGTH + 1);
    expect(validatePlayInput(tooLong)).toEqual({ ok: false, problem: 'too-long' });
  });

  it('accepts input exactly at the limit', () => {
    const atLimit = 'a'.repeat(MAX_PLAY_INPUT_LENGTH);
    expect(validatePlayInput(atLimit)).toEqual({ ok: true, value: atLimit });
  });

  it('rejects embedded control characters', () => {
    expect(validatePlayInput('song\nname')).toEqual({ ok: false, problem: 'control-characters' });
    expect(validatePlayInput('song\u0000name')).toEqual({
      ok: false,
      problem: 'control-characters',
    });
  });

  it('accepts ordinary unicode text', () => {
    expect(validatePlayInput('夜に駆ける')).toEqual({ ok: true, value: '夜に駆ける' });
  });
});
