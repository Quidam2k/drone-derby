// Tool palette structure + keyboard map, kept free of JSX so the hotkey
// dispatch logic is unit-testable in node. ToolPalette pairs these entries
// with icons; EditorScreen feeds real KeyboardEvents through
// editorKeyCommand.

import type { ToolId } from '../../store/editorStore';

export interface ToolEntry {
  id: ToolId;
  /** Single-key hotkey (lowercase), unique across all tools. */
  key: string;
  label: string;
}

export const TOOL_SECTIONS: { title: string; tools: ToolEntry[] }[] = [
  {
    title: 'Terrain',
    tools: [
      { id: 'floor', key: 'f', label: 'Floor (erase)' },
      { id: 'pit', key: 'p', label: 'Pit' },
      { id: 'drain', key: 'd', label: 'Drain (a pit with a grate)' },
      { id: 'trapdoor', key: 't', label: 'Trap-door pit' },
    ],
  },
  {
    title: 'Hazards',
    tools: [
      { id: 'radiation', key: 'r', label: 'Radiation floor' },
      { id: 'waste', key: 'a', label: 'Radioactive waste' },
      { id: 'crusher', key: 'u', label: 'Crusher' },
      { id: 'flamer', key: 'm', label: 'Flamer' },
    ],
  },
  {
    title: 'Movers',
    tools: [
      { id: 'conveyor', key: 'c', label: 'Conveyor' },
      { id: 'gear', key: 'g', label: 'Gear' },
      { id: 'portal', key: 'o', label: 'Portal (paired)' },
      { id: 'teleporter', key: 'x', label: 'Teleporter' },
      { id: 'repulsor', key: 'q', label: 'Repulsor field' },
    ],
  },
  {
    title: 'Course',
    tools: [
      { id: 'checkpoint', key: 'k', label: 'Checkpoint' },
      { id: 'spawn', key: 's', label: 'Spawn dock' },
      { id: 'wrench', key: 'n', label: 'Repair (wrench)' },
    ],
  },
  {
    title: 'Edges',
    tools: [
      { id: 'wall', key: 'w', label: 'Wall' },
      { id: 'laser', key: 'l', label: 'Laser' },
      { id: 'pusher', key: 'h', label: 'Pusher' },
    ],
  },
  {
    title: 'Eraser',
    tools: [{ id: 'eraser', key: 'e', label: 'Eraser' }],
  },
];

export const TOOL_HOTKEYS: Record<string, ToolId> = Object.fromEntries(
  TOOL_SECTIONS.flatMap((s) => s.tools.map((t) => [t.key, t.id])),
);

export type EditorKeyCommand =
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'tool'; tool: ToolId }
  | null;

/**
 * Map a keydown to an editor command, or null to leave it alone. Form
 * fields keep every key (their own undo included); modified keys other
 * than the undo/redo chords stay free for the browser.
 */
export function editorKeyCommand(e: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  targetTag: string | undefined;
}): EditorKeyCommand {
  if (e.targetTag === 'INPUT' || e.targetTag === 'TEXTAREA' || e.targetTag === 'SELECT') {
    return null;
  }
  const key = e.key.toLowerCase();
  if (e.ctrlKey || e.metaKey) {
    if (key === 'z') return e.shiftKey ? { type: 'redo' } : { type: 'undo' };
    if (key === 'y') return { type: 'redo' };
    return null;
  }
  if (e.altKey || e.shiftKey) return null;
  const tool = TOOL_HOTKEYS[key];
  return tool ? { type: 'tool', tool } : null;
}
