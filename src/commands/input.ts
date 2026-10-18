/**
 * Validation for `/play` input.
 *
 * This module only validates shape and size. URL classification, hostname
 * allowlisting, and provider selection are separate, later tasks.
 */

/** SECURITY.md / TRD.md: bound query length before any provider call. */
export const MAX_PLAY_INPUT_LENGTH = 500;

export type PlayInputProblem = 'empty' | 'too-long' | 'control-characters';

export type PlayInputResult =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly problem: PlayInputProblem };

/**
 * Validate and normalize raw `/play` input.
 *
 * Returns the trimmed value on success. Control characters (including
 * embedded newlines and tabs) are rejected rather than silently stripped.
 */
export function validatePlayInput(raw: string): PlayInputResult {
  const value = raw.trim();

  if (value.length === 0) {
    return { ok: false, problem: 'empty' };
  }

  if (value.length > MAX_PLAY_INPUT_LENGTH) {
    return { ok: false, problem: 'too-long' };
  }

  // Intentionally matches C0/C1 control characters so they are rejected
  // before reaching any provider or log sink.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F-\u009F]/.test(value)) {
    return { ok: false, problem: 'control-characters' };
  }

  return { ok: true, value };
}
