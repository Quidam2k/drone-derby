import { describe, expect, it } from 'vitest';
import { chooseRenderer, parseRenderOverride, type Renderer } from './rendererChoice';

describe('parseRenderOverride', () => {
  const cases: [string, Renderer | null][] = [
    ['http://localhost:5173/', null],
    ['http://localhost:5173/#/hotseat', null],
    // Query string, both spellings, with and without a trailing hash route.
    ['http://localhost:5173/?render=3d', '3d'],
    ['http://localhost:5173/?render=3d#/hotseat', '3d'],
    ['http://localhost:5173/?render=dom', 'dom'],
    ['http://localhost:5173/?render=dom#/hotseat', 'dom'],
    // After the hash — routing here is hash-based, so this is the form a
    // player who edits the URL of a running game actually types.
    ['http://localhost:5173/#/hotseat?render=3d', '3d'],
    ['http://localhost:5173/#/hotseat?render=dom', 'dom'],
    ['http://localhost:5173/#/game/abc?render=dom&x=1', 'dom'],
    ['http://localhost:5173/?a=1&render=3d&b=2', '3d'],
    // Near misses must not match.
    ['http://localhost:5173/?render=3dx', null],
    ['http://localhost:5173/?render=domino', null],
    ['http://localhost:5173/?norender=3d', null],
    ['http://localhost:5173/?render=2d', null],
  ];

  for (const [href, want] of cases) {
    it(`${href} → ${want}`, () => {
      expect(parseRenderOverride(href)).toBe(want);
    });
  }

  it('dom wins when both appear — the escape hatch is not overrulable', () => {
    expect(parseRenderOverride('http://x/?render=3d&render=dom')).toBe('dom');
  });
});

describe('chooseRenderer', () => {
  const able = { webgl2: true, failed: false };

  it('defaults to 3D — no flag, no failure, stored preference 3d', () => {
    expect(chooseRenderer({ override: null, preference: '3d', ...able })).toBe('3d');
  });

  it('honours a stored dom preference', () => {
    expect(chooseRenderer({ override: null, preference: 'dom', ...able })).toBe('dom');
  });

  it('?render=dom beats a stored 3d preference', () => {
    expect(chooseRenderer({ override: 'dom', preference: '3d', ...able })).toBe('dom');
  });

  it('?render=3d beats a stored dom preference', () => {
    expect(chooseRenderer({ override: '3d', preference: 'dom', ...able })).toBe('3d');
  });

  it('no WebGL2 → dom, even against an explicit ?render=3d', () => {
    expect(chooseRenderer({ override: '3d', preference: '3d', webgl2: false, failed: false })).toBe(
      'dom',
    );
  });

  it('a scene that threw → dom, even against an explicit ?render=3d', () => {
    expect(chooseRenderer({ override: '3d', preference: '3d', webgl2: true, failed: true })).toBe(
      'dom',
    );
  });

  it('?render=dom still resolves to dom when 3D is perfectly available', () => {
    expect(chooseRenderer({ override: 'dom', preference: 'dom', ...able })).toBe('dom');
  });

  it('the full precedence table', () => {
    // override, preference, webgl2, failed → renderer
    const table: [Renderer | null, Renderer, boolean, boolean, Renderer][] = [
      [null, '3d', true, false, '3d'],
      [null, '3d', true, true, 'dom'],
      [null, '3d', false, false, 'dom'],
      [null, 'dom', true, false, 'dom'],
      [null, 'dom', false, false, 'dom'],
      ['3d', '3d', true, false, '3d'],
      ['3d', 'dom', true, false, '3d'],
      ['3d', 'dom', true, true, 'dom'],
      ['3d', 'dom', false, false, 'dom'],
      ['dom', '3d', true, false, 'dom'],
      ['dom', '3d', false, true, 'dom'],
    ];
    for (const [override, preference, webgl2, failed, want] of table) {
      expect(
        chooseRenderer({ override, preference, webgl2, failed }),
        `override=${override} pref=${preference} webgl2=${webgl2} failed=${failed}`,
      ).toBe(want);
    }
  });
});
