import type { Direction, TileDef } from '../../engine';

const CONVEYOR_ARROW: Record<Direction, string> = { N: '↑', E: '→', S: '↓', W: '←' };

interface TileProps {
  def: TileDef;
  /** Cell sides carrying a wall (drawn as thick edge strips). */
  walls: Direction[];
  /** Facings of board-laser emitters located in this cell (mounted on the opposite wall). */
  emitterFacings: Direction[];
}

function tileContent(def: TileDef) {
  switch (def.kind) {
    case 'floor':
      return null;
    case 'pit':
      return <span className="tile-glyph pit-glyph">◉</span>;
    case 'conveyor':
      return (
        <span className={`tile-glyph conveyor-glyph${def.express ? ' express' : ''}`}>
          {CONVEYOR_ARROW[def.dir]}
          {def.express ? CONVEYOR_ARROW[def.dir] : ''}
        </span>
      );
    case 'gear':
      return <span className="tile-glyph gear-glyph">{def.cw ? '↻' : '↺'}</span>;
    case 'checkpoint':
      return <span className="tile-glyph checkpoint-glyph">{def.n}</span>;
    case 'spawn':
      return <span className="tile-glyph spawn-glyph">{def.n}</span>;
  }
}

export function Tile({ def, walls, emitterFacings }: TileProps) {
  return (
    <div className={`tile tile-${def.kind}`}>
      {tileContent(def)}
      {walls.map((side) => (
        <div key={side} className={`wall wall-${side.toLowerCase()}`} />
      ))}
      {emitterFacings.map((facing) => (
        <div key={facing} className={`emitter emitter-${facing.toLowerCase()}`} title="laser emitter" />
      ))}
    </div>
  );
}
