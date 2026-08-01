// Hotkey map integrity + keydown → command dispatch (pure logic; the
// EditorScreen listener just forwards real KeyboardEvent fields here).

import { describe, expect, it } from 'vitest';
import { TOOL_HOTKEYS, TOOL_SECTIONS, editorKeyCommand } from './editorHotkeys';

function key(overrides: Partial<Parameters<typeof editorKeyCommand>[0]> & { key: string }) {
  return editorKeyCommand({
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    targetTag: 'BODY',
    ...overrides,
  });
}

describe('editorHotkeys', () => {
  it('assigns every tool exactly one unique single-letter key', () => {
    const entries = TOOL_SECTIONS.flatMap((s) => s.tools);
    expect(entries).toHaveLength(20);
    const keys = entries.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(k).toMatch(/^[a-z]$/);
    const ids = entries.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('maps plain keys to tool selection (case-insensitive)', () => {
    expect(key({ key: 'w' })).toEqual({ type: 'tool', tool: 'wall' });
    expect(key({ key: 'K' })).toEqual({ type: 'tool', tool: 'checkpoint' });
    expect(key({ key: 'e' })).toEqual({ type: 'tool', tool: 'eraser' });
    for (const [k, tool] of Object.entries(TOOL_HOTKEYS)) {
      expect(key({ key: k })).toEqual({ type: 'tool', tool });
    }
  });

  it('maps the undo/redo chords', () => {
    expect(key({ key: 'z', ctrlKey: true })).toEqual({ type: 'undo' });
    expect(key({ key: 'z', metaKey: true })).toEqual({ type: 'undo' });
    expect(key({ key: 'Z', ctrlKey: true, shiftKey: true })).toEqual({ type: 'redo' });
    expect(key({ key: 'y', ctrlKey: true })).toEqual({ type: 'redo' });
  });

  it('leaves form fields alone entirely', () => {
    expect(key({ key: 'w', targetTag: 'INPUT' })).toBeNull();
    expect(key({ key: 'z', ctrlKey: true, targetTag: 'INPUT' })).toBeNull();
    expect(key({ key: 'p', targetTag: 'TEXTAREA' })).toBeNull();
    expect(key({ key: 'p', targetTag: 'SELECT' })).toBeNull();
  });

  it('ignores modified keys and unmapped keys', () => {
    expect(key({ key: 'w', ctrlKey: true })).toBeNull(); // browser close-tab etc.
    expect(key({ key: 'c', ctrlKey: true })).toBeNull(); // copy
    expect(key({ key: 'w', altKey: true })).toBeNull();
    expect(key({ key: 'W', shiftKey: true })).toBeNull();
    expect(key({ key: 'j' })).toBeNull();
    expect(key({ key: 'Escape' })).toBeNull();
  });
});
