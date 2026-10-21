# Board coverage — official RoboRally boards online (2026-10-21, #4755)

**Bottom line: every official 1994-era board is available as a clean 1800×1800
top-down image (~150 px per square on a 12×12 board). Todd does not need to
photograph any of them.** Only the official scenario/flag sheets are still
worth a photo (we place flags ourselves today).

## Source

Gareth Taylor's RoboRally board collection — https://tartarus.org/gareth/roborally
(index: `/boards/all`; images: `https://www.tartarus.org/gareth/roborally/images/<Name>.board.png`,
plus `.board.2005.png` (Avalon Hill 2005 art) and `.gimp.png` (757×757) variants).
These look like the maintainer's tidied redraws, not camera scans: square, no glare, no
perspective. Checked visually on Gear Box.

**Licensing:** the site states no license or terms, and the art is © Wizards of the Coast /
Hasbro. Treated as **private reference only**. The images are in the gitignored
`input/reference_photos/tartarus/` folder (25 files, 114 MB). They are **never committed,
deployed, or shipped as game art**; only our own transcriptions (BoardDef code) go in the repo,
the same as the four boards already photographed. No source found forbids private viewing, so
nothing needed escalating.

## Coverage

All 25 below: **found, full board, 1800×1800, top-down**. None are low-res or partial.

| Board | Set | Status in Drone Derby |
|---|---|---|
| Cannery Row | Base (1994) | to transcribe |
| Cross | Base | to transcribe |
| Exchange | Base | to transcribe |
| Island | Base | to transcribe |
| Maelstrom | Base | to transcribe |
| Pit Maze | Base | to transcribe |
| Chasm | Armed and Dangerous | to transcribe |
| Circuit Trap | Armed and Dangerous | to transcribe |
| Colosseum | Armed and Dangerous | to transcribe |
| Flood Zone | Armed and Dangerous | to transcribe |
| Gear Box | Armed and Dangerous | **transcribed** (from Todd's photos) |
| Laser Maze | Armed and Dangerous | to transcribe |
| Back Stretch | Grand Prix | to transcribe |
| Canyon | Grand Prix | to transcribe |
| Pit Row | Grand Prix | to transcribe |
| Blast Furnace | Crash and Burn | to transcribe |
| Machine Shop | Crash and Burn | to transcribe |
| Pinwheel | Radioactive | **transcribed** |
| Reactor Core | Radioactive | **transcribed** |
| Shake 'n' Bake | Radioactive | **transcribed** |
| Chess | 2005 Avalon Hill | to transcribe |
| Chop Shop | 2005 Avalon Hill | to transcribe (chop shop squares become plain floor, since option cards are cut) |
| Spin Zone | 2005 Avalon Hill | to transcribe |
| Vault | 2005 Avalon Hill | to transcribe |
| King of the Hill | Origins '99 promo | to transcribe |

**Missing / gaps for Todd to photograph:** no boards. Still useful: the official
**scenario/course sheets** (flag placements, board combos) and the **program cards** (see
pending-card-photos). Later editions on the same site (2016 1A–6B, Thrills and Spills,
Chaos and Carnage, Wet and Wild, 2023) are out of scope for the 1994 rules. Many of those are
posted deliberately small because they are still in print.

Not found anywhere: machine-readable board data (JSON/tile lists). The fan editors found
export images only.

## How this slots into the authentic-boards work

The images are square and grid-aligned, so transcription no longer needs the perspective warp
from the photo method. Next cascade ("authentic boards II"):
1. A script slices each image into 144 cells and builds a labelled contact sheet per board
   (the existing cell-sheet method, minus the warp).
2. Cell-by-cell transcription into BoardDef, in census-tested built-ins like the existing four.
   Check the elements against the engine's supported set (all 1994 / A&D / Radioactive elements
   already exist after Phases 35–37). Grand Prix and Crash and Burn may add new ones (e.g. Blast
   Furnace flamers already exist; check Canyon and Back Stretch for anything new).
3. Cross-check the method by re-transcribing Gear Box from the image and diffing it against
   the photo-based transcription.
4. Order: base six first, since they are the classic friend-night boards.
