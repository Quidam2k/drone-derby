import { Component, type ErrorInfo, type ReactNode } from 'react';
import { convex } from './services/convex';
import { logTelemetry } from './services/telemetry';
import { useRoute } from './services/route';
import { HotSeatGame } from './components/hotseat/HotSeatGame';
import { EditorScreen } from './components/editor/EditorScreen';
import { LobbyScreen } from './components/online/LobbyScreen';
import { JoinScreen } from './components/online/JoinScreen';
import { OnlineGameScreen } from './components/online/OnlineGameScreen';
import { GalleryScreen } from './components/online/GalleryScreen';

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
 * One-tap playtest note — for gameplay/feel bugs that don't throw. The
 * current hash (route/gameId) rides along in the telemetry context.
 */
function BugButton() {
  return (
    <button
      className="bug-note-btn"
      type="button"
      title="Something broken or off? Leave a note"
      onClick={() => {
        const text = window.prompt('What went wrong / felt off?');
        if (text && text.trim()) logTelemetry('note', text.trim());
      }}
    >
      🐞
    </button>
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

export function App() {
  return (
    <>
      <Screen />
      <BugButton />
    </>
  );
}
