import type { Direction, TileDef } from '../../engine';
import {
  CheckpointSprite,
  ConveyorSprite,
  CrusherSprite,
  DrainSprite,
  EmitterSprite,
  FlamerSprite,
  GearSprite,
  PitSprite,
  PortalSprite,
  PusherSprite,
  RadiationSprite,
  RepulsorSprite,
  SpawnSprite,
  TeleporterSprite,
  TrapdoorSprite,
  WasteSprite,
  WrenchSprite,
} from './sprites';

/** One wall on a cell edge, with the one-way variant when present. */
export interface WallSeg {
  side: Direction;
  oneWay?: 'in' | 'out';
}

interface TileProps {
  def: TileDef;
  /** Walls on this cell's edges (drawn as thick edge strips). */
  walls: WallSeg[];
  /** Facings of board-laser emitters located in this cell (mounted on the opposite wall). */
  emitterFacings: Direction[];
  /** Pushers in this cell (mounted on the wall opposite their push direction). */
  pushers?: { facing: Direction; registers: number[] }[];
  /** Overhead crushers over this cell (register schedule on the plate). */
  crushers?: { registers: number[] }[];
  /** Flamer jets in this cell (register schedule in the flame). */
  flamers?: { registers: number[] }[];
}

function tileContent(def: TileDef) {
  switch (def.kind) {
    case 'floor':
      return null;
    case 'pit':
      return def.style === 'drain' ? <DrainSprite /> : <PitSprite />;
    case 'trapdoor':
      return <TrapdoorSprite registers={def.registers} />;
    case 'radiation':
      return <RadiationSprite />;
    case 'waste':
      return <WasteSprite />;
    case 'portal':
      return <PortalSprite color={def.color} />;
    case 'teleporter':
      return <TeleporterSprite />;
    case 'repulsor':
      return <RepulsorSprite />;
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

export function Tile({ def, walls, emitterFacings, pushers, crushers, flamers }: TileProps) {
  return (
    <div className={`tile tile-${def.kind}`}>
      {tileContent(def)}
      {walls.map((w) => (
        <div
          key={w.side}
          className={`wall wall-${w.side.toLowerCase()}${w.oneWay ? ` oneway-${w.oneWay}` : ''}`}
          title={w.oneWay ? 'one-way wall (passable from the green side)' : undefined}
        />
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
      {crushers?.map((c, i) => (
        <div key={i} className="crusher" title={`crusher (${c.registers.join('/')})`}>
          <CrusherSprite registers={c.registers} />
        </div>
      ))}
      {flamers?.map((f, i) => (
        <div key={i} className="flamer" title={`flamer (${f.registers.join('/')})`}>
          <FlamerSprite registers={f.registers} />
        </div>
      ))}
    </div>
  );
}
