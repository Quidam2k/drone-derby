import type { Direction, TileDef } from '../../engine';
import {
  CheckpointSprite,
  ConveyorSprite,
  EmitterSprite,
  GearSprite,
  PitSprite,
  SpawnSprite,
} from './sprites';

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
      return <PitSprite />;
    case 'conveyor':
      return <ConveyorSprite dir={def.dir} express={def.express} />;
    case 'gear':
      return <GearSprite cw={def.cw} />;
    case 'checkpoint':
      return <CheckpointSprite n={def.n} />;
    case 'spawn':
      return <SpawnSprite n={def.n} />;
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
        <div key={facing} className={`emitter emitter-${facing.toLowerCase()}`} title="laser emitter">
          <EmitterSprite facing={facing} />
        </div>
      ))}
    </div>
  );
}
