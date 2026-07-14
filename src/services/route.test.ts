import { describe, expect, it } from 'vitest';
import { parseHash } from './route';

describe('parseHash', () => {
  it('parses every route', () => {
    expect(parseHash('#/')).toEqual({ name: 'home' });
    expect(parseHash('#/hotseat')).toEqual({ name: 'hotseat' });
    expect(parseHash('#/editor')).toEqual({ name: 'editor' });
    expect(parseHash('#/editor/abc123')).toEqual({ name: 'editor', boardId: 'abc123' });
    expect(parseHash('#/game/g42')).toEqual({ name: 'game', gameId: 'g42' });
    expect(parseHash('#/join/xyz')).toEqual({ name: 'join', code: 'xyz' });
    expect(parseHash('#/gallery')).toEqual({ name: 'gallery' });
    expect(parseHash('#/rules')).toEqual({ name: 'rules' });
  });

  it('falls back to home for empty or unknown hashes', () => {
    expect(parseHash('')).toEqual({ name: 'home' });
    expect(parseHash('#')).toEqual({ name: 'home' });
    expect(parseHash('#/nonsense')).toEqual({ name: 'home' });
    // routes that require an argument fall back when it's missing
    expect(parseHash('#/game')).toEqual({ name: 'home' });
    expect(parseHash('#/join')).toEqual({ name: 'home' });
  });
});
