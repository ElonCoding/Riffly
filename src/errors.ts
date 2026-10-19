/**
 * Typed error model for Riffly.
 *
 * Every operational error has a code and a safe user-facing message.
 * Internal diagnostics live in the `cause` field and are NEVER surfaced to
 * the user directly.
 */

export type RifflyErrorCode =
  | 'InvalidInput'
  | 'UnsupportedProvider'
  | 'NoResults'
  | 'MetadataOnly'
  | 'PlaybackNotPermitted'
  | 'ProviderUnavailable'
  | 'TrackUnavailable'
  | 'VoicePermissionDenied'
  | 'LavalinkUnavailable'
  | 'QueueLimitExceeded'
  | 'RateLimited'
  | 'NotInVoiceChannel'
  | 'NotPlaying'
  | 'AlreadyPaused'
  | 'NotPaused'
  | 'EmptyQueue'
  | 'InternalError';

export class RifflyError extends Error {
  readonly code: RifflyErrorCode;
  /** Safe message for Discord users — must not contain secrets or internal paths. */
  readonly userMessage: string;

  constructor(code: RifflyErrorCode, userMessage: string, cause?: unknown) {
    super(userMessage, { cause });
    this.name = 'RifflyError';
    this.code = code;
    this.userMessage = userMessage;
  }

  static invalidInput(detail: string): RifflyError {
    return new RifflyError('InvalidInput', `❌ Invalid input: ${detail}`);
  }

  static unsupportedProvider(host: string): RifflyError {
    return new RifflyError(
      'UnsupportedProvider',
      `❌ Unsupported source: \`${host}\` is not on the allowed list.`,
    );
  }

  static noResults(query: string): RifflyError {
    return new RifflyError('NoResults', `🔍 No results found for **${query}**.`);
  }

  static notInVoiceChannel(): RifflyError {
    return new RifflyError('NotInVoiceChannel', '🔇 You must be in a voice channel to use this.');
  }

  static notPlaying(): RifflyError {
    return new RifflyError('NotPlaying', '⏹️ Nothing is currently playing.');
  }

  static alreadyPaused(): RifflyError {
    return new RifflyError('AlreadyPaused', '⏸️ Playback is already paused.');
  }

  static notPaused(): RifflyError {
    return new RifflyError('NotPaused', '▶️ Playback is not paused.');
  }

  static emptyQueue(): RifflyError {
    return new RifflyError('EmptyQueue', '📭 The queue is empty.');
  }

  static queueLimitExceeded(limit: number): RifflyError {
    return new RifflyError('QueueLimitExceeded', `📋 Queue limit of ${limit} tracks reached.`);
  }

  static lavalinkUnavailable(): RifflyError {
    return new RifflyError(
      'LavalinkUnavailable',
      '🔧 Audio service is unavailable. Try again in a moment.',
    );
  }

  static trackUnavailable(cause?: unknown): RifflyError {
    return new RifflyError('TrackUnavailable', '🚫 That track is unavailable for playback.', cause);
  }

  static internal(cause?: unknown): RifflyError {
    return new RifflyError('InternalError', '💥 An internal error occurred.', cause);
  }
}
