import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react';
import { convex } from './services/convex';
import { logTelemetry } from './services/telemetry';
import { collectRepro } from './services/diagnostics';
import { onUpdateAvailable, takeUpdate } from './services/swUpdate';
import { useRoute } from './services/route';
import { HotSeatGame } from './components/hotseat/HotSeatGame';
import { EditorScreen } from './components/editor/EditorScreen';
import { LobbyScreen } from './components/online/LobbyScreen';
import { JoinScreen } from './components/online/JoinScreen';
import { OnlineGameScreen } from './components/online/OnlineGameScreen';
import { GalleryScreen } from './components/online/GalleryScreen';
import { RulesScreen } from './components/rules/RulesScreen';

/** Catches render-time errors (e.g. a malformed game id in the hash). */
class RouteBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    logTelemetry('react-error', error.message, {
      stack: error.stack,
      componentStack: info.componentStack,
    });
  }
  render() {
    if (this.state.error) {
      return (
        <div className="screen center-screen">
          <h1>Something went wrong</h1>
          <p className="setup-hint">{this.state.error.message}</p>
          <a className="primary-link" href="#/" onClick={() => this.setState({ error: null })}>
            ‹ Back to the lobby
          </a>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * One-tap playtest note — for gameplay/feel bugs that don't throw, which is
 * the class of bug nothing else here can see: a wrong outcome never raises an
 * error, so this button is the whole instrument. `collectRepro()` rides along
 * so a note is reproducible instead of merely suggestive.
 *
 * An in-app form rather than `window.prompt`, which some embedded and iOS
 * contexts suppress outright — a playtester on a phone would tap the button
 * and watch nothing happen, which is worse than having no button at all.
 */
function BugButton() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');

  const submit = () => {
    const note = text.trim();
    if (note) logTelemetry('note', note, collectRepro());
    setText('');
    setOpen(false);
  };

  return (
    <>
      <button
        className="bug-note-btn"
        type="button"
        title="Something broken or off? Leave a note"
        onClick={() => setOpen(true)}
      >
        🐞
      </button>
      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div
            className="modal bug-note-modal"
            role="dialog"
            aria-label="Report a problem"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>What went wrong / felt off?</h3>
            <p className="modal-hint">
              The board, turn and recent events are attached automatically.
            </p>
            <textarea
              autoFocus
              rows={4}
              value={text}
              placeholder="The push looked wrong on turn 4…"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit();
                if (e.key === 'Escape') setOpen(false);
              }}
            />
            <div className="modal-actions">
              <button type="button" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button type="button" className="primary" disabled={!text.trim()} onClick={submit}>
                Send note
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Screen() {
  const route = useRoute();

  // The editor works with or without a backend; a boardId in the hash loads
  // a cloud-saved board (which needs Convex + sign-in, handled inside).
  if (route.name === 'editor') {
    return (
      <RouteBoundary key={route.boardId ?? ''}>
        <EditorScreen boardId={route.boardId} />
      </RouteBoundary>
    );
  }

  // Rules are static — no backend, no sign-in, safe from any entry point.
  if (route.name === 'rules') return <RulesScreen />;

  // No backend configured: the game is hot-seat only.
  if (!convex) return <HotSeatGame />;

  switch (route.name) {
    case 'home':
      return <LobbyScreen />;
    case 'hotseat':
      return <HotSeatGame />;
    case 'join':
      return (
        <RouteBoundary key={route.code}>
          <JoinScreen code={route.code} />
        </RouteBoundary>
      );
    case 'game':
      return (
        <RouteBoundary key={route.gameId}>
          <OnlineGameScreen gameId={route.gameId} />
        </RouteBoundary>
      );
    case 'gallery':
      return <GalleryScreen />;
  }
}

/**
 * "A newer build is waiting." Without this a returning player runs the
 * previous build until some later refresh, which during a playtest means bug
 * reports filed against code we already fixed.
 */
function UpdateBanner() {
  const [available, setAvailable] = useState(false);
  useEffect(() => onUpdateAvailable(setAvailable), []);
  if (!available) return null;
  return (
    <div className="update-banner" role="status">
      <span>A new version is ready.</span>
      <button type="button" className="primary" onClick={takeUpdate}>
        Reload
      </button>
    </div>
  );
}

export function App() {
  return (
    <>
      <Screen />
      <UpdateBanner />
      <BugButton />
    </>
  );
}
