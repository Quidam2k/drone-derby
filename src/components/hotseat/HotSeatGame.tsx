// Pass & play on one device — Phase 2's game, unchanged, now living at
// #/hotseat. Works with no backend at all (offline/testing path).

import { useGameStore } from '../../store/gameStore';
import { convex } from '../../services/convex';
import { SetupScreen } from '../programming/SetupScreen';
import { HandoffScreen } from '../programming/HandoffScreen';
import { ProgrammingView } from '../programming/ProgrammingView';
import { GameOverScreen } from '../programming/GameOverScreen';
import { ReplayPlayer } from '../replay/ReplayPlayer';

export function HotSeatGame() {
  const store = useGameStore();
  const { screen, game, currentSeat, lastTurn } = store;

  switch (screen) {
    case 'setup':
      return (
        <>
          {convex && (
            <a className="back-link" href="#/">
              ‹ Lobby
            </a>
          )}
          <SetupScreen onStart={store.startGame} />
        </>
      );
    case 'handoff':
      return (
        <HandoffScreen
          name={game!.robots[currentSeat].player}
          seat={currentSeat}
          turn={game!.turn}
          onReady={store.beginProgramming}
        />
      );
    case 'programming':
      return (
        <ProgrammingView
          key={`${game!.turn}:${currentSeat}`}
          game={game!}
          seat={currentSeat}
          onSubmit={store.submitProgram}
        />
      );
    case 'replay':
      return (
        <ReplayPlayer
          prevState={lastTurn!.prevState}
          events={lastTurn!.events}
          taunts={lastTurn!.taunts}
          onDone={store.finishReplay}
        />
      );
    case 'gameover':
      return <GameOverScreen winner={game!.winner} finalState={game} onNewGame={store.newGame} />;
  }
}
