// Inline SVG sprites for board elements and robots. All sprites share a
// 52x52 viewBox (the desktop tile size) and scale to their container via
// the .sprite class (width/height 100%), so mobile tileFit sizing needs no
// changes here. Colors come from the existing CSS palette / custom
// properties so themes keep working. No external assets, no canvas.

import { useId } from 'react';

import type { Direction } from '../../engine';

const DIR_ANGLE: Record<Direction, number> = { N: 0, E: 90, S: 180, W: 270 };

export function PitSprite() {
  return (
    <svg className="sprite" viewBox="0 0 52 52" aria-hidden="true">
      {/* hazard-striped rim, then the hole falling away to black */}
      <circle
        cx="26"
        cy="26"
        r="21.5"
        fill="none"
        stroke="var(--wall)"
        strokeWidth="3"
        strokeDasharray="5.2 6"
        opacity="0.5"
      />
      <circle cx="26" cy="26" r="17.5" fill="#0a0b11" />
      <circle cx="26" cy="26" r="17.5" fill="none" stroke="rgba(0, 0, 0, 0.8)" strokeWidth="3" />
      <circle cx="26" cy="26" r="11" fill="#04050a" />
      <path
        d="M 13.5 20.5 A 14.5 14.5 0 0 1 20.5 13.5"
        fill="none"
        stroke="rgba(255, 255, 255, 0.1)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Curved belt section. Drawn in a canonical frame — exit N through the top
 * edge — then rotated to the exit `dir` like the straight sprite. In that
 * frame a CW curve is entered from the east edge (the rider travels W, turns
 * to N), so the band is a quarter annulus centred on the tile's NE corner
 * (52, 0); the CCW curve is its horizontal mirror. Chevrons sit ON the arc
 * and march entry → exit as a staggered opacity cycle (see index.css) —
 * rotating a group would need transform-origin gymnastics for zero gain.
 */
function CurvedConveyor({ express, curve }: { express: boolean; curve: 'cw' | 'ccw' }) {
  const color = express ? 'var(--accent)' : '#8ea0c9';
  // Chevron angles back from the exit edge along the arc; entry-side first
  // so index order is march order.
  const angles = express ? [78.75, 56.25, 33.75, 11.25] : [75, 45, 15];
  const periodS = express ? 0.9 : 1.8;
  return (
    <g transform={curve === 'ccw' ? 'matrix(-1 0 0 1 52 0)' : undefined}>
      {/* band: quarter annulus, radii 10–42 about the NE corner */}
      <path
        d="M 10 0 A 42 42 0 0 0 52 42 L 52 10 A 10 10 0 0 1 42 0 Z"
        fill="rgba(0, 0, 0, 0.22)"
      />
      {/* rails, matching the straight sprite's side strips */}
      <path
        d="M 8.5 0 A 43.5 43.5 0 0 0 52 43.5"
        fill="none"
        stroke="rgba(255, 255, 255, 0.14)"
        strokeWidth="3"
      />
      <path
        d="M 43.5 0 A 8.5 8.5 0 0 0 52 8.5"
        fill="none"
        stroke="rgba(255, 255, 255, 0.14)"
        strokeWidth="3"
      />
      <g className={`conveyor-curve-chevrons conveyor-${express ? 'express' : 'normal'}`}>
        {angles.map((a, i) => (
          <polyline
            key={a}
            transform={`rotate(${-a} 52 0) translate(26 0)`}
            points="-10,4 0,-4 10,4"
            fill="none"
            stroke={color}
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ animationDelay: `${(i / angles.length - 1) * periodS}s` }}
          />
        ))}
      </g>
    </g>
  );
}

export function ConveyorSprite({
  dir,
  express,
  curve,
}: {
  dir: Direction;
  express: boolean;
  curve?: 'cw' | 'ccw';
}) {
  const chevronYs = express ? [17, 29, 41] : [23.5, 36.5];
  const color = express ? 'var(--accent)' : '#8ea0c9';
  const period = express ? 12 : 13;
  // Per-instance id: a shared id would make every belt on the board resolve
  // url(#…) to whichever tile rendered first, and break when it unmounts.
  // useId's raw value carries punctuation that isn't URL-fragment safe.
  // Called before the curve branch — hooks must not sit behind a return.
  const clipId = `conveyor-clip${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  if (curve) {
    return (
      <svg className="sprite" viewBox="0 0 52 52" aria-hidden="true">
        <g transform={`rotate(${DIR_ANGLE[dir]} 26 26)`}>
          <CurvedConveyor express={express} curve={curve} />
        </g>
      </svg>
    );
  }
  return (
    <svg className="sprite" viewBox="0 0 52 52" aria-hidden="true">
      {/* drawn pointing N, rotated per direction */}
      <g transform={`rotate(${DIR_ANGLE[dir]} 26 26)`}>
        <rect x="10" y="0" width="32" height="52" fill="rgba(0, 0, 0, 0.22)" />
        <rect x="7" y="0" width="3" height="52" fill="rgba(255, 255, 255, 0.14)" />
        <rect x="42" y="0" width="3" height="52" fill="rgba(255, 255, 255, 0.14)" />
        {/* Chevron group scrolls upward, clipped to tile */}
        <defs>
          <clipPath id={clipId}>
            <rect x="10" y="0" width="32" height="52" />
          </clipPath>
        </defs>
        <g
          className={`conveyor-chevrons conveyor-${express ? 'express' : 'normal'}`}
          clipPath={`url(#${clipId})`}
          style={{ '--conveyor-period': `${period}px` } as React.CSSProperties}
        >
          {/* Extra chevron above for seamless wrap */}
          <polyline
            points={`16,${chevronYs[0] - period} 26,${chevronYs[0] - period - 8} 36,${chevronYs[0] - period}`}
            fill="none"
            stroke={color}
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {chevronYs.map((y) => (
            <polyline
              key={y}
              points={`16,${y} 26,${y - 8} 36,${y}`}
              fill="none"
              stroke={color}
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {/* Extra chevron below for seamless wrap */}
          <polyline
            points={`16,${chevronYs[chevronYs.length - 1] + period} 26,${chevronYs[chevronYs.length - 1] + period - 8} 36,${chevronYs[chevronYs.length - 1] + period}`}
            fill="none"
            stroke={color}
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </g>
    </svg>
  );
}

/** Toothed-ring outline as a polygon: straight flanks are fine at tile size. */
function gearPoints(cx: number, cy: number, rOuter: number, rInner: number, teeth: number): string {
  const pts: string[] = [];
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * step;
    const corners: [number, number][] = [
      [a + 0.08 * step, rOuter],
      [a + 0.42 * step, rOuter],
      [a + 0.5 * step, rInner],
      [a + step, rInner],
    ];
    for (const [ang, r] of corners) {
      pts.push(`${(cx + r * Math.sin(ang)).toFixed(2)},${(cy - r * Math.cos(ang)).toFixed(2)}`);
    }
  }
  return pts.join(' ');
}

const GEAR_OUTLINE = gearPoints(26, 26, 23, 17, 8);

export function GearSprite({ cw }: { cw: boolean }) {
  return (
    <svg className="sprite" viewBox="0 0 52 52" aria-hidden="true">
      {/* drawn CW; mirrored horizontally for CCW (the gear is symmetric) */}
      <g transform={cw ? undefined : 'matrix(-1 0 0 1 52 0)'}>
        <polygon points={GEAR_OUTLINE} fill="#c88f3c" stroke="#8a5f22" strokeWidth="1.5" />
        <circle cx="26" cy="26" r="6" fill="rgba(0, 0, 0, 0.45)" />
        <path
          d="M 26 15 A 11 11 0 1 1 15 26"
          fill="none"
          stroke="rgba(0, 0, 0, 0.55)"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <polygon points="15,18.5 10.8,27 19.2,27" fill="rgba(0, 0, 0, 0.55)" />
      </g>
    </svg>
  );
}

const CHECKPOINT_TICKS: [number, number, number, number][] = [
  [26, 6.5, 26, 2],
  [26, 45.5, 26, 50],
  [6.5, 26, 2, 26],
  [45.5, 26, 50, 26],
];

export function CheckpointSprite({ n }: { n: number }) {
  return (
    <svg className="sprite" viewBox="0 0 52 52" aria-hidden="true">
      {CHECKPOINT_TICKS.map(([x1, y1, x2, y2]) => (
        <line
          key={`${x1},${y1}`}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="#43aa8b"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      ))}
      <circle cx="26" cy="26" r="16.5" fill="rgba(67, 170, 139, 0.13)" stroke="#43aa8b" strokeWidth="3" />
      <text
        x="26"
        y="27"
        textAnchor="middle"
        dominantBaseline="central"
        fill="#6fe3bd"
        fontSize="19"
        fontWeight="700"
      >
        {n}
      </text>
    </svg>
  );
}

/**
 * Repair site: an open-end wrench at 45° on a service hatch. Drawn from two
 * strokes (handle + jaw arc) so it stays legible at the 24px mobile tile.
 */
export function WrenchSprite() {
  return (
    <svg className="sprite" viewBox="0 0 52 52" aria-hidden="true">
      <rect
        x="8"
        y="8"
        width="36"
        height="36"
        rx="7"
        fill="rgba(111, 227, 189, 0.07)"
        stroke="#43aa8b"
        strokeWidth="2"
        strokeDasharray="6 4"
      />
      <g transform="rotate(45 26 26)">
        {/* handle */}
        <rect x="22.5" y="16" width="7" height="24" rx="3" fill="#8ea0c9" />
        {/* head: a ring with the jaw notched out of the top */}
        <circle cx="26" cy="14.5" r="7.5" fill="#8ea0c9" />
        <rect x="22.6" y="4" width="6.8" height="12" fill="var(--panel, #1f2230)" />
        <circle cx="26" cy="41" r="4.6" fill="#8ea0c9" />
      </g>
    </svg>
  );
}

const SPAWN_BOLTS: [number, number][] = [
  [14, 14],
  [38, 14],
  [14, 38],
  [38, 38],
];

export function SpawnSprite({ n }: { n: number }) {
  return (
    <svg className="sprite" viewBox="0 0 52 52" aria-hidden="true">
      <rect
        x="9"
        y="9"
        width="34"
        height="34"
        rx="6"
        fill="rgba(255, 255, 255, 0.03)"
        stroke="var(--line)"
        strokeWidth="2"
        strokeDasharray="5 4"
      />
      {SPAWN_BOLTS.map(([x, y]) => (
        <circle key={`${x},${y}`} cx={x} cy={y} r="1.7" fill="var(--text-dim)" opacity="0.55" />
      ))}
      <text
        x="26"
        y="27"
        textAnchor="middle"
        dominantBaseline="central"
        fill="var(--text-dim)"
        fontSize="14"
        fontWeight="600"
      >
        {n}
      </text>
    </svg>
  );
}

/**
 * Robot chassis, rendered in Blender and baked to a transparent PNG.
 * See scripts/blender/robots.py; regenerate with `npm run art`.
 *
 * Each seat has its OWN chassis as well as its own colour -- tracked scout,
 * hexapod walker, hovercraft, quad buggy -- so the four are told apart by
 * silhouette, which is the only cue that survives the 24px mobile tile.
 * Colour is baked in, so there is no `--seat` custom property here.
 *
 * All are modelled facing N; facing rotation is CSS on .robot-body. The
 * contact shadow deliberately is NOT baked in -- it lives on the
 * non-rotating .robot wrapper so it can't swing around as the robot turns.
 */
export function RobotSprite({ seat = 0 }: { seat?: number }) {
  return <img className="sprite" src={`/robots/robot-${seat % 4}.png`} alt="" aria-hidden="true" />;
}

/**
 * Wall-mounted pusher piston: housing on the mounted edge, hazard-striped
 * plate poised to shove, register numbers ("1 3 5" / "2 4") on the housing.
 * Drawn pushing N (housing on the S edge) and rotated to `facing`; odd and
 * even variants are told apart by plate colour as well as the numbers.
 */
export function PusherSprite({ facing, registers }: { facing: Direction; registers: number[] }) {
  const odd = registers.includes(1);
  const plate = odd ? '#e0b341' : '#8ea0c9';
  return (
    <svg className="sprite" viewBox="0 0 52 52" aria-hidden="true">
      <g transform={`rotate(${DIR_ANGLE[facing]} 26 26)`}>
        {/* piston rods, retracted against the housing */}
        <rect x="14.5" y="36" width="5" height="9" fill="#2c3145" />
        <rect x="32.5" y="36" width="5" height="9" fill="#2c3145" />
        {/* plate with hazard chevrons */}
        <rect x="8" y="30" width="36" height="7" rx="2" fill={plate} />
        {[14, 24, 34].map((x) => (
          <path
            key={x}
            d={`M ${x} 37 l 5 -7`}
            stroke="rgba(0, 0, 0, 0.4)"
            strokeWidth="3.5"
          />
        ))}
        {/* housing on the mounted wall, numbers readable on its face */}
        <rect x="6" y="43" width="40" height="9" rx="2" fill="#4a5069" />
        <text
          x="26"
          y="47.8"
          textAnchor="middle"
          dominantBaseline="central"
          fill="#dde3f2"
          fontSize="8"
          fontWeight="700"
          letterSpacing="2"
        >
          {registers.join(' ')}
        </text>
      </g>
    </svg>
  );
}

/** Wall-mounted laser barrel, drawn firing E and rotated to the facing. */
const EMITTER_ANGLE: Record<Direction, number> = { E: 0, S: 90, W: 180, N: 270 };

export function EmitterSprite({ facing }: { facing: Direction }) {
  return (
    <svg className="sprite" viewBox="0 0 52 52" aria-hidden="true">
      <g transform={`rotate(${EMITTER_ANGLE[facing]} 26 26)`}>
        <rect x="0" y="12" width="9" height="28" rx="2" fill="#4a5069" />
        <rect x="7" y="19" width="26" height="14" rx="5" fill="#7d3436" />
        <rect x="30" y="22" width="12" height="8" rx="2" fill="var(--danger)" />
        <circle cx="43" cy="26" r="5" fill="var(--danger)" />
      </g>
    </svg>
  );
}
