// One seat's programming turn: live board + their hand + 5 register slots.
// Click a hand card to select it, then a register to place it; click a
// filled register to take the card back. Locked registers show their held
// card and cannot be edited.

import { useEffect, useMemo, useState } from 'react';
import type { Card, Direction, GameState, Program } from '../../engine';
import { countCheckpoints, isRegisterLocked, previewProgram } from '../../engine';
import { play } from '../../services/audio';
import { setFocusPlayer } from '../../services/viewSettings';
import { BoardView } from '../board/BoardView';
import { PlayerStrip } from '../board/PlayerStrip';
import { CARD_GLYPH, CARD_LABEL } from '../cards';
import { initialVisual, visualAt } from '../replay/visualState';

/** Fixed cadence for stepping the ghost through its preview events. */
const GHOST_STEP_MS = 220;

function CardFace({ card, small }: { card: Card; small?: boolean }) {
  return (
    <span className={`card-face${small ? ' small' : ''}`}>
      <span className="card-glyph">{CARD_GLYPH[card.type]}</span>
      <span className="card-name">{CARD_LABEL[card.type]}</span>
      <span className="card-priority">{card.priority}</span>
    </span>
  );
}

const FACING_ARROWS: { dir: Direction; glyph: string }[] = [
  { dir: 'N', glyph: '↑' },
  { dir: 'E', glyph: '→' },
  { dir: 'S', glyph: '↓' },
  { dir: 'W', glyph: '←' },
];

interface ProgrammingViewProps {
  game: GameState;
  seat: number;
  onSubmit: (
    program: Program,
    taunt?: string,
    respawnFacing?: Direction,
    powerDown?: boolean,
  ) => void;
}

const NULL_PROGRAM: Program = [null, null, null, null, null];

export function ProgrammingView({ game, seat, onSubmit }: ProgrammingViewProps) {
  const robot = game.robots[seat];
  const hand = game.hands[robot.player];
  // Powered down this turn: no hand, no registers — the whole turn is the
  // one-tap stay/wake choice below, riding an all-null program.
  const isDown = robot.poweredDown === true;
  const [slots, setSlots] = useState<(Card | null)[]>([null, null, null, null, null]);
  const [selected, setSelected] = useState<Card | null>(null);
  const [taunt, setTaunt] = useState('');
  // Just-respawned robots pick their re-entry facing while programming; the
  // choice rides the submission and the engine turns them at the start of
  // the next turn. Default N matches the engine's no-choice behavior.
  const choosingFacing = robot.justRespawned === true;
  const [respawnFacing, setRespawnFacing] = useState<Direction>('N');
  // Any robot may announce a power-down for NEXT turn (1994 rule) — the
  // counterweight to the repair economy: all damage clears at that turn's
  // start, at the price of sitting exposed through it.
  const [powerDown, setPowerDown] = useState(false);

  // Play card-deal sound when the hand is first rendered.
  useEffect(() => {
    if (!isDown) play('card-deal');
  }, [isDown]);

  // Whoever is programming is "me" for the 3D camera's My-robot lock — true
  // in hot-seat and online alike. Cleared on the way out so a pass-and-play
  // replay, which has no single local player, doesn't inherit the last seat;
  // OnlineGameScreen re-publishes its own seat every render, so the online
  // lock survives this component unmounting.
  useEffect(() => {
    setFocusPlayer(robot.player);
    return () => setFocusPlayer(null);
  }, [robot.player]);

  // The live board with the facing picker applied: the robot on the board
  // turns as the picker is toggled (the 3D rig eases the swing, the DOM
  // board just re-renders). Everything the engine will do is unchanged —
  // this is a purely visual override until the choice ships with submit.
  const liveVisual = useMemo(() => {
    const v = initialVisual(game);
    if (choosingFacing) v.robots[seat] = { ...v.robots[seat], facing: respawnFacing };
    return v;
  }, [game, seat, choosingFacing, respawnFacing]);

  // Ghost preview: solo engine sim of the turn-so-far (board effects only —
  // other robots are excluded, so the ghost may pass through them). Replays
  // once from the start whenever placements change, then rests at the pose.
  const previewEvents = useMemo(
    () => previewProgram(game, robot.player, slots, choosingFacing ? respawnFacing : undefined),
    [game, robot.player, slots, choosingFacing, respawnFacing],
  );
  const [previewCursor, setPreviewCursor] = useState(0);
  useEffect(() => {
    if (previewEvents.length === 0) {
      setPreviewCursor(0);
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setPreviewCursor(previewEvents.length); // jump straight to the final pose
      return;
    }
    setPreviewCursor(0);
    let i = 0;
    let timer: number | undefined;
    const tick = () => {
      i += 1;
      setPreviewCursor(i);
      if (i < previewEvents.length) timer = window.setTimeout(tick, GHOST_STEP_MS);
    };
    timer = window.setTimeout(tick, GHOST_STEP_MS);
    return () => window.clearTimeout(timer);
  }, [previewEvents]);

  const ghostRobot =
    previewEvents.length > 0
      ? visualAt(liveVisual, previewEvents, previewCursor).robots[seat]
      : null;

  const placedIds = new Set(slots.filter((c): c is Card => c !== null).map((c) => c.id));
  const locked = (r: number) => isRegisterLocked(robot.damage, r);
  const ready = slots.every((c, i) => locked(i + 1) || c !== null);

  const placeIn = (i: number) => {
    if (locked(i + 1)) return;
    if (slots[i]) {
      // Take the card back to the hand.
      setSlots(slots.map((c, j) => (j === i ? null : c)));
      return;
    }
    if (!selected) return;
    setSlots(slots.map((c, j) => (j === i ? selected : c)));
    setSelected(null);
  };

  const submit = () => {
    play('click');
    // Locked slots are ignored by the engine; send null there.
    onSubmit(
      slots.map((c, i) => (locked(i + 1) ? null : c)),
      taunt.trim() || undefined,
      choosingFacing ? respawnFacing : undefined,
      powerDown || undefined,
    );
  };

  // The powered-down turn is a single choice: stay down another turn or wake
  // up. It still submits (same await as any other player) — an all-null
  // program the engine ignores, carrying the stay/wake flag.
  if (isDown) {
    const choose = (stay: boolean) => {
      play('click');
      onSubmit(NULL_PROGRAM, undefined, undefined, stay);
    };
    return (
      <div className="screen programming-screen">
        <header className="programming-header">
          <h2>
            <span className="player-swatch" style={{ background: `var(--player-${seat})` }} />
            {robot.player} — turn {game.turn}: powered down
          </h2>
        </header>

        <div className="game-layout">
          <BoardView board={game.board} visual={liveVisual} />
          <PlayerStrip
            visual={liveVisual}
            checkpointTarget={countCheckpoints(game.board)}
            activeSeat={seat}
          />
        </div>

        <div className="powered-down-panel" data-testid="powered-down-choice">
          <p className="powered-down-note">
            Your robot is powered down — all damage clears as the turn starts, but it can't
            move, and belts, pushes and lasers still hit it.
          </p>
          <div className="powered-down-buttons">
            <button
              className="primary"
              onClick={() => choose(true)}
              data-testid="stay-powered-down"
            >
              ⏻ Stay powered down
            </button>
            <button className="primary" onClick={() => choose(false)} data-testid="wake-up">
              Wake up
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen programming-screen">
      <header className="programming-header">
        <h2>
          <span className="player-swatch" style={{ background: `var(--player-${seat})` }} />
          {robot.player} — program turn {game.turn}
        </h2>
      </header>

      <div className="game-layout">
        <BoardView
          board={game.board}
          visual={liveVisual}
          ghost={ghostRobot ? { robot: ghostRobot, seat } : undefined}
        />
        <PlayerStrip
          visual={liveVisual}
          checkpointTarget={countCheckpoints(game.board)}
          activeSeat={seat}
        />
      </div>

      {choosingFacing && (
        <div className="respawn-facing-row" data-testid="respawn-facing">
          <span className="respawn-facing-label">Back in play — face:</span>
          {FACING_ARROWS.map(({ dir, glyph }) => (
            <button
              key={dir}
              className={respawnFacing === dir ? 'selected' : ''}
              onClick={() => {
                play('click');
                setRespawnFacing(dir);
              }}
              title={`face ${dir}`}
              data-testid={`respawn-facing-${dir}`}
            >
              {glyph}
            </button>
          ))}
        </div>
      )}

      <div className="registers" data-testid="registers">
        {slots.map((slot, i) => {
          const isLocked = locked(i + 1);
          const held = isLocked ? robot.lockedRegisters[i] : slot;
          return (
            <button
              key={i}
              className={`register-slot${isLocked ? ' locked' : ''}${held ? ' filled' : ''}`}
              onClick={() => placeIn(i)}
              disabled={isLocked}
              data-testid={`register-${i + 1}`}
            >
              <span className="register-label">{isLocked ? `🔒 ${i + 1}` : i + 1}</span>
              {held ? <CardFace card={held} small /> : <span className="register-empty">—</span>}
            </button>
          );
        })}
      </div>

      <div className="hand" data-testid="hand">
        {hand.map((card) => {
          const placed = placedIds.has(card.id);
          return (
            <button
              key={card.id}
              className={`hand-card${selected?.id === card.id ? ' selected' : ''}${placed ? ' placed' : ''}`}
              disabled={placed}
              onClick={() => setSelected(selected?.id === card.id ? null : card)}
              data-testid={`card-${card.id}`}
            >
              <CardFace card={card} />
            </button>
          );
        })}
      </div>

      <div className="programming-footer">
        <input
          className="taunt-input"
          value={taunt}
          maxLength={60}
          placeholder="Say something… (shown in the replay)"
          onChange={(e) => setTaunt(e.target.value)}
          data-testid="taunt-input"
        />
        <button
          className={`power-down-toggle${powerDown ? ' selected' : ''}`}
          onClick={() => {
            play('click');
            setPowerDown(!powerDown);
          }}
          title="Announce a power-down: next turn your robot repairs ALL damage but sits inert — no moves, no laser — while the board still acts on it"
          data-testid="power-down-toggle"
        >
          ⏻ Power down next turn{powerDown ? ' ✓' : ''}
        </button>
        <span className="hint">
          {selected
            ? 'Tap a register to place the card'
            : ready
              ? 'All registers set'
              : 'Select a card from your hand'}
        </span>
        <button className="primary" disabled={!ready} onClick={submit} data-testid="submit-program">
          Submit program
        </button>
      </div>
    </div>
  );
}
