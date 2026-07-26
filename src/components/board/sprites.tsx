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

export function ConveyorSprite({ dir, express }: { dir: Direction; express: boolean }) {
  const chevronYs = express ? [17, 29, 41] : [23.5, 36.5];
  const color = express ? 'var(--accent)' : '#8ea0c9';
  const period = express ? 12 : 13;
  // Per-instance id: a shared id would make every belt on the board resolve
  // url(#…) to whichever tile rendered first, and break when it unmounts.
  // useId's raw value carries punctuation that isn't URL-fragment safe.
  const clipId = `conveyor-clip${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
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
 * Four robot variants by seat (0-3) with distinct silhouettes + bright facing light.
 * All drawn pointing N; facing rotation is via CSS on .robot-body.
 * Translucent blacks/whites overlay so any player color works underneath.
 */
export function RobotSprite({ seat = 0 }: { seat?: number }) {
  const variant = seat % 4;

  if (variant === 0) {
    // Seat 0: Round dome head
    return (
      <svg className="sprite" viewBox="0 0 52 52" aria-hidden="true">
        <circle cx="26" cy="16" r="11" fill="rgba(0, 0, 0, 0.45)" />
        {/* Bright nose light (facing cue) */}
        <circle cx="26" cy="2.5" r="3.5" fill="rgba(76, 201, 240, 0.95)" />
        <circle cx="26" cy="2.5" r="2" fill="rgba(255, 255, 255, 0.8)" />
        <rect x="3" y="10" width="7" height="34" rx="3.5" fill="rgba(0, 0, 0, 0.3)" />
        <rect x="42" y="10" width="7" height="34" rx="3.5" fill="rgba(0, 0, 0, 0.3)" />
        <circle cx="21" cy="15" r="2.5" fill="rgba(255, 255, 255, 0.88)" />
        <circle cx="31" cy="15" r="2.5" fill="rgba(255, 255, 255, 0.88)" />
        <rect x="15" y="30" width="22" height="12" rx="3" fill="rgba(0, 0, 0, 0.16)" />
      </svg>
    );
  } else if (variant === 1) {
    // Seat 1: Square blocky head
    return (
      <svg className="sprite" viewBox="0 0 52 52" aria-hidden="true">
        <rect x="14" y="6" width="24" height="20" rx="2" fill="rgba(0, 0, 0, 0.45)" />
        {/* Bright nose light (facing cue) */}
        <rect x="22.5" y="1" width="7" height="6" rx="1.5" fill="rgba(76, 201, 240, 0.95)" />
        <rect x="24" y="2" width="4" height="3.5" fill="rgba(255, 255, 255, 0.8)" />
        <rect x="3" y="10" width="6" height="34" rx="3" fill="rgba(0, 0, 0, 0.3)" />
        <rect x="43" y="10" width="6" height="34" rx="3" fill="rgba(0, 0, 0, 0.3)" />
        <circle cx="20" cy="14" r="2.2" fill="rgba(255, 255, 255, 0.88)" />
        <circle cx="32" cy="14" r="2.2" fill="rgba(255, 255, 255, 0.88)" />
        <rect x="16" y="30" width="20" height="12" rx="3" fill="rgba(0, 0, 0, 0.16)" />
      </svg>
    );
  } else if (variant === 2) {
    // Seat 2: Angular wedge head
    return (
      <svg className="sprite" viewBox="0 0 52 52" aria-hidden="true">
        <polygon points="26,5 14,22 38,22" fill="rgba(0, 0, 0, 0.45)" />
        {/* Bright nose light (facing cue) */}
        <polygon points="26,2 23,6 29,6" fill="rgba(76, 201, 240, 0.95)" />
        <polygon points="26,3.5 24,5.5 28,5.5" fill="rgba(255, 255, 255, 0.8)" />
        <rect x="2" y="12" width="7" height="32" rx="3.5" fill="rgba(0, 0, 0, 0.3)" />
        <rect x="43" y="12" width="7" height="32" rx="3.5" fill="rgba(0, 0, 0, 0.3)" />
        <circle cx="19" cy="16" r="2.3" fill="rgba(255, 255, 255, 0.88)" />
        <circle cx="33" cy="16" r="2.3" fill="rgba(255, 255, 255, 0.88)" />
        <rect x="16" y="30" width="20" height="12" rx="3" fill="rgba(0, 0, 0, 0.16)" />
      </svg>
    );
  } else {
    // Seat 3: Twin antenna head
    return (
      <svg className="sprite" viewBox="0 0 52 52" aria-hidden="true">
        <rect x="16" y="8" width="20" height="16" rx="2" fill="rgba(0, 0, 0, 0.45)" />
        {/* Left antenna */}
        <line x1="20" y1="8" x2="18" y2="0.5" stroke="rgba(0, 0, 0, 0.55)" strokeWidth="2.5" strokeLinecap="round" />
        {/* Right antenna */}
        <line x1="32" y1="8" x2="34" y2="0.5" stroke="rgba(0, 0, 0, 0.55)" strokeWidth="2.5" strokeLinecap="round" />
        {/* Bright nose light (facing cue) */}
        <circle cx="26" cy="2" r="3" fill="rgba(76, 201, 240, 0.95)" />
        <circle cx="26" cy="2" r="1.5" fill="rgba(255, 255, 255, 0.8)" />
        <rect x="3" y="12" width="7" height="32" rx="3" fill="rgba(0, 0, 0, 0.3)" />
        <rect x="42" y="12" width="7" height="32" rx="3" fill="rgba(0, 0, 0, 0.3)" />
        <circle cx="21" cy="16" r="2.3" fill="rgba(255, 255, 255, 0.88)" />
        <circle cx="31" cy="16" r="2.3" fill="rgba(255, 255, 255, 0.88)" />
        <rect x="15" y="30" width="22" height="12" rx="3" fill="rgba(0, 0, 0, 0.16)" />
      </svg>
    );
  }
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
