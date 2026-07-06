// One seat's programming turn: live board + their hand + 5 register slots.
// Click a hand card to select it, then a register to place it; click a
// filled register to take the card back. Locked registers show their held
// card and cannot be edited.

import { useState } from 'react';
import type { Card, GameState, Program } from '../../engine';
import { countCheckpoints, isRegisterLocked } from '../../engine';
import { Board } from '../board/Board';
import { PlayerStrip } from '../board/PlayerStrip';
import { CARD_GLYPH, CARD_LABEL } from '../cards';
import { initialVisual } from '../replay/visualState';

function CardFace({ card, small }: { card: Card; small?: boolean }) {
  return (
    <span className={`card-face${small ? ' small' : ''}`}>
      <span className="card-glyph">{CARD_GLYPH[card.type]}</span>
      <span className="card-name">{CARD_LABEL[card.type]}</span>
      <span className="card-priority">{card.priority}</span>
    </span>
  );
}

interface ProgrammingViewProps {
  game: GameState;
  seat: number;
  onSubmit: (program: Program, taunt?: string) => void;
}

export function ProgrammingView({ game, seat, onSubmit }: ProgrammingViewProps) {
  const robot = game.robots[seat];
  const hand = game.hands[robot.player];
  const [slots, setSlots] = useState<(Card | null)[]>([null, null, null, null, null]);
  const [selected, setSelected] = useState<Card | null>(null);
  const [taunt, setTaunt] = useState('');

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
    // Locked slots are ignored by the engine; send null there.
    onSubmit(
      slots.map((c, i) => (locked(i + 1) ? null : c)),
      taunt.trim() || undefined,
    );
  };

  return (
    <div className="screen programming-screen">
      <header className="programming-header">
        <h2>
          <span className="player-swatch" style={{ background: `var(--player-${seat})` }} />
          {robot.player} — program turn {game.turn}
        </h2>
      </header>

      <div className="game-layout">
        <Board board={game.board} visual={initialVisual(game)} />
        <PlayerStrip
          visual={initialVisual(game)}
          checkpointTarget={countCheckpoints(game.board)}
          activeSeat={seat}
        />
      </div>

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
