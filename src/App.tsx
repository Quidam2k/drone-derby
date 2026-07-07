import { Component, type ReactNode } from 'react';
import { convex } from './services/convex';
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

export function App() {
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
