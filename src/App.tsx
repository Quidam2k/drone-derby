import { useGameStore } from './store/gameStore';
import { SetupScreen } from './components/programming/SetupScreen';
import { HandoffScreen } from './components/programming/HandoffScreen';
import { ProgrammingView } from './components/programming/ProgrammingView';
import { GameOverScreen } from './components/programming/GameOverScreen';
import { ReplayPlayer } from './components/replay/ReplayPlayer';

export function App() {
  const store = useGameStore();
  const { screen, game, currentSeat, lastTurn } = store;

  switch (screen) {
    case 'setup':
      return <SetupScreen onStart={store.startGame} />;
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
          onDone={store.finishReplay}
        />
      );
    case 'gameover':
      return <GameOverScreen winner={game!.winner} onNewGame={store.newGame} />;
  }
}
