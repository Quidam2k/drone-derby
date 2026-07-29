import type { Direction, TileDef } from '../../engine';
import {
  CheckpointSprite,
  ConveyorSprite,
  EmitterSprite,
  GearSprite,
  PitSprite,
  PusherSprite,
  SpawnSprite,
  WrenchSprite,
} from './sprites';

interface TileProps {
  def: TileDef;
  /** Cell sides carrying a wall (drawn as thick edge strips). */
  walls: Direction[];
  /** Facings of board-laser emitters located in this cell (mounted on the opposite wall). */
  emitterFacings: Direction[];
  /** Pushers in this cell (mounted on the wall opposite their push direction). */
  pushers?: { facing: Direction; registers: number[] }[];
}

function tileContent(def: TileDef) {
  switch (def.kind) {
    case 'floor':
      return null;
    case 'pit':
      return <PitSprite />;
    case 'conveyor':
      return <ConveyorSprite dir={def.dir} express={def.express} curve={def.curve} />;
    case 'gear':
      return <GearSprite cw={def.cw} />;
    case 'checkpoint':
      return <CheckpointSprite n={def.n} />;
    case 'spawn':
      return <SpawnSprite n={def.n} />;
    case 'wrench':
      return <WrenchSprite />;
  }
}

export function Tile({ def, walls, emitterFacings, pushers }: TileProps) {
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
      {pushers?.map((p) => (
        <div key={p.facing} className="pusher" title={`pusher (${p.registers.join('/')})`}>
          <PusherSprite facing={p.facing} registers={p.registers} />
        </div>
      ))}
    </div>
  );
}
