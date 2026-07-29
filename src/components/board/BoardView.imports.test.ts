// The drift the cutover creates, and nothing else catches — Phase 3D-7.
//
// Before this phase every player-facing screen imported BOTH boards and picked
// one at module scope. The cutover deletes those four ternaries and routes
// everything through <BoardView>, which is the only place the preference, the
// URL override, the WebGL2 probe and the failure fallback exist. A screen that
// goes back to importing `Board` or `Board3D` directly still typechecks, still
// renders, and silently opts itself out of all four.
//
// So this reads the files as text and asserts they don't — the same crude
// approach, for the same reason, as Board3D.props.test.ts.
//
// The DOM board keeps two legitimate direct importers, both permanent and both
// named below: EditorBoard (its hit layer finds cells with
// `document.elementFromPoint`, which cannot work over a tilted canvas) and
// BoardThumb (DOM/SVG). Neither lives in the directories scanned here.

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const componentsDir = fileURLToPath(new URL('..', import.meta.url));

/** Every source file under components/<dir>/, recursively. */
function sources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(componentsDir + dir, { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...sources(rel));
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(rel);
  }
  return out;
}

const SCANNED = ['replay', 'programming', 'online'];
/** Module specifiers that mean "I picked a renderer myself". */
const DIRECT = /from\s+'[^']*\/(board\/Board|board3d\/Board3D)'/;

describe('the player-facing screens go through BoardView', () => {
  const files = SCANNED.flatMap(sources);

  it('found the files to check — the scan itself has to keep working', () => {
    expect(files).toContain('replay/ReplayPlayer.tsx');
    expect(files).toContain('replay/HighlightReel.tsx');
    expect(files).toContain('programming/ProgrammingView.tsx');
    expect(files).toContain('online/OnlineGameScreen.tsx');
  });

  for (const file of SCANNED.flatMap(sources)) {
    it(`${file} imports neither Board nor Board3D directly`, () => {
      const source = readFileSync(componentsDir + file, 'utf8');
      const hit = source.split('\n').find((line) => DIRECT.test(line));
      expect(hit, `${file} must import BoardView, not a renderer directly`).toBeUndefined();
    });
  }

  it('all four boards on screen are BoardView', () => {
    const users = [
      'replay/ReplayPlayer.tsx',
      'replay/HighlightReel.tsx',
      'programming/ProgrammingView.tsx',
      'online/OnlineGameScreen.tsx',
    ];
    for (const file of users) {
      const source = readFileSync(componentsDir + file, 'utf8');
      expect(source, `${file} lost its BoardView import`).toContain("from '../board/BoardView'");
      expect(source, `${file} stopped rendering a board`).toContain('<BoardView');
    }
  });

  it('the editor still imports the DOM board directly — that one is permanent', () => {
    // Not an oversight and not a candidate for BoardView: the editor paints
    // tiles through `document.elementFromPoint`, which needs real DOM cells.
    const editor = readFileSync(componentsDir + 'editor/EditorBoard.tsx', 'utf8');
    expect(editor).toContain("from '../board/Board'");
    expect(editor).not.toContain('BoardView');
  });
});
