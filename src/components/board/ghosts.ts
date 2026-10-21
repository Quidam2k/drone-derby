// Ghost marks for the programming preview, shared by both board renderers:
// the engine's per-register poses folded into one mark per square, so two
// registers ending on the same square read as one ghost badged "2·3".

import type { Direction, GhostPose, Position } from '../../engine';

export interface GhostMark {
  pos: Position;
  /** Facing of the latest register that ends here. */
  facing: Direction;
  /** Register numbers ending on this square, e.g. "1" or "2·3". */
  label: string;
  /** False for the death square: drawn as a wreck marker, not a robot. */
  alive: boolean;
}

export function ghostMarks(poses: GhostPose[]): GhostMark[] {
  const marks: GhostMark[] = [];
  for (const p of poses) {
    const same = marks.find(
      (m) => m.alive === p.alive && m.pos.x === p.pos.x && m.pos.y === p.pos.y,
    );
    if (same) {
      same.label += `·${p.register}`;
      same.facing = p.facing;
    } else {
      marks.push({ pos: p.pos, facing: p.facing, label: String(p.register), alive: p.alive });
    }
  }
  return marks;
}
