import { describe, expect, it } from 'vitest';
import { classifyInput } from '../src/provider/classifier.js';

const allowlist = new Map([
  ['soundcloud.com', 'lavalink'],
  ['www.soundcloud.com', 'lavalink'],
  ['on.soundcloud.com', 'lavalink'],
]);

describe('classifyInput', () => {
  it('classifies plain text as search', () => {
    const r = classifyInput('lofi hip hop', allowlist);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.input.kind).toBe('search');
      if (r.input.kind === 'search') expect(r.input.query).toBe('lofi hip hop');
    }
  });

  it('classifies allowlisted track URL', () => {
    const r = classifyInput('https://soundcloud.com/artist/track', allowlist);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.input.kind).toBe('track-url');
  });

  it('classifies playlist URL when path contains /sets/', () => {
    const r = classifyInput('https://soundcloud.com/artist/sets/playlist', allowlist);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.input.kind).toBe('playlist-url');
  });

  it('rejects unknown host', () => {
    const r = classifyInput('https://unknown.example.com/track', allowlist);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('UnsupportedProvider');
  });

  it('rejects non-http scheme', () => {
    const r = classifyInput('ftp://soundcloud.com/track', allowlist);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('InvalidInput');
  });

  it('rejects URL with embedded credentials', () => {
    const r = classifyInput('https://user:pass@soundcloud.com/track', allowlist);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('InvalidInput');
  });

  it('treats http URL not on allowlist as unsupported', () => {
    const r = classifyInput('https://youtube.com/watch?v=abc', allowlist);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('UnsupportedProvider');
  });

  it('classifies YouTube-style ?list= as playlist', () => {
    const extendedAllowlist = new Map([...allowlist, ['youtube.com', 'lavalink']]);
    const r = classifyInput('https://youtube.com/playlist?list=PLxxx', extendedAllowlist);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.input.kind).toBe('playlist-url');
  });
});
