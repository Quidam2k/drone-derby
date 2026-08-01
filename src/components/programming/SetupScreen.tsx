import { useState } from 'react';
import type { BoardDef, Position } from '../../engine';
import { applyFlagPlacements, BUILTIN_BOARDS } from '../../engine';
import { BoardPicker, type BoardOption } from '../board/BoardThumb';
import { FlagPlacer } from '../board/FlagPlacer';

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 4;

const BOARD_OPTIONS: BoardOption[] = Object.entries(BUILTIN_BOARDS).map(([key, b]) => ({
  value: key,
  name: b.name,
  board: b.factory(),
}));

interface SetupScreenProps {
  onStart: (names: string[], board?: BoardDef) => void;
}

export function SetupScreen({ onStart }: SetupScreenProps) {
  const [names, setNames] = useState<string[]>(['', '']);
  const [boardKey, setBoardKey] = useState('proving-grounds');
  /** Custom flag positions; null = the board's printed flags (untouched). */
  const [flags, setFlags] = useState<Position[] | null>(null);

  const trimmed = names.map((n) => n.trim());
  const valid =
    trimmed.every((n) => n.length > 0) && new Set(trimmed).size === trimmed.length;

  return (
    <div className="screen center-screen setup-screen">
      <h1 className="title">Drone Derby</h1>
      <p className="subtitle">
        Program your robot. Survive the factory. Hit the checkpoints.{' '}
        <a className="primary-link setup-rules-link" href="#/rules" data-testid="rules-link">
          How to play
        </a>
      </p>

      <div className="setup-players">
        {names.map((name, i) => (
          <div key={i} className="setup-row">
            <span className="player-swatch" style={{ background: `var(--player-${i})` }} />
            <input
              value={name}
              placeholder={`Player ${i + 1}`}
              maxLength={16}
              onChange={(e) =>
                setNames(names.map((n, j) => (j === i ? e.target.value : n)))
              }
              data-testid={`name-${i}`}
            />
            {names.length > MIN_PLAYERS && (
              <button
                className="remove-player"
                title="remove player"
                onClick={() => setNames(names.filter((_, j) => j !== i))}
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      {names.length < MAX_PLAYERS && (
        <button className="add-player" onClick={() => setNames([...names, ''])}>
          + Add player
        </button>
      )}

      <BoardPicker
        options={BOARD_OPTIONS}
        value={boardKey}
        onChange={(v) => {
          setBoardKey(v);
          setFlags(null); // custom flags are per-board
        }}
      />
      <FlagPlacer
        board={BOARD_OPTIONS.find((o) => o.value === boardKey)!.board}
        placements={flags}
        onChange={setFlags}
      />

      <button
        className="primary big"
        disabled={!valid || flags?.length === 0}
        onClick={() =>
          onStart(
            trimmed,
            flags
              ? applyFlagPlacements(BUILTIN_BOARDS[boardKey].factory(), flags)
              : BUILTIN_BOARDS[boardKey].factory(),
          )
        }
        data-testid="start-game"
      >
        Start game
      </button>
      {!valid && trimmed.some((n) => n.length > 0) && (
        <p className="setup-hint">Everyone needs a unique, non-empty name.</p>
      )}
    </div>
  );
}
