// Board gallery (#/gallery): browse boards other pilots published and start
// a game on any of them. createGame snapshots the board, so a later
// unpublish/edit/delete never touches games already created from it.

import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { navigate } from '../../services/route';
import { useEditorStore } from '../../store/editorStore';
import { BoardThumb } from '../board/BoardThumb';
import { errorMessage, SignInGate, useSavedName } from './common';

/** Board names are capped at 40 chars (editor toolbar input). */
function forkName(name: string): string {
  return `Copy of ${name}`.slice(0, 40);
}

export function GalleryScreen() {
  return (
    <SignInGate>
      <GalleryInner />
    </SignInGate>
  );
}

function GalleryInner() {
  const boards = useQuery(api.boards.gallery);
  const createGame = useMutation(api.games.createGame);
  const loadDraft = useEditorStore((s) => s.loadDraft);
  const [name, setName] = useSavedName();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const create = (boardId: string) => {
    setBusyId(boardId);
    setError(null);
    createGame({ name, boardId: boardId as Id<'boards'> })
      .then(({ gameId }) => navigate(`#/game/${gameId}`))
      .catch((e: unknown) => setError(errorMessage(e)))
      .finally(() => setBusyId(null));
  };

  return (
    <div className="screen lobby-screen">
      <header className="lobby-header">
        <h1 className="title">Board gallery</h1>
        <a className="back-link" href="#/">
          ‹ Lobby
        </a>
      </header>
      <p className="lobby-card-note">
        Boards published by other pilots. Starting a game copies the board, so it keeps working
        even if the author changes theirs later.
      </p>

      <input
        value={name}
        placeholder="Your name"
        maxLength={16}
        onChange={(e) => setName(e.target.value)}
        data-testid="gallery-name"
        className="gallery-name"
      />
      {error && <p className="error-note">{error}</p>}

      {boards === undefined ? (
        <p className="setup-hint">Loading…</p>
      ) : boards.length === 0 ? (
        <p className="setup-hint">
          Nothing here yet — publish one of your own boards from the editor!
        </p>
      ) : (
        <div className="gallery-grid">
          {boards.map((b) => (
            <div className="lobby-card gallery-card" key={b.boardId} data-testid="gallery-card">
              <BoardThumb board={b.board} tilePx={10} maxPx={200} />
              <h3>{b.name}</h3>
              <p className="lobby-card-note">
                {b.board.width}×{b.board.height} ·{' '}
                {b.mine ? <span className="published-chip">yours</span> : `by ${b.authorName}`}
              </p>
              {b.forkedFrom && (
                <p className="lobby-card-note">
                  forked from {b.forkedFrom.name} by {b.forkedFrom.authorName}
                </p>
              )}
              <button
                className="primary"
                disabled={busyId !== null || name.trim().length === 0}
                onClick={() => create(b.boardId)}
                data-testid={`gallery-create-${b.boardId}`}
              >
                {busyId === b.boardId ? 'Creating…' : 'New game on this board'}
              </button>
              <button
                title="Replaces your current editor draft (Ctrl+Z in the editor restores it). Saving online creates your own new board."
                onClick={() => {
                  loadDraft(
                    { ...b.board, name: forkName(b.name) },
                    { name: b.name, authorName: b.authorName || 'anonymous' },
                  );
                  navigate('#/editor');
                }}
                data-testid={`gallery-fork-${b.boardId}`}
              >
                Open a copy in the editor
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
