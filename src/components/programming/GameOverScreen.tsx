interface GameOverScreenProps {
  winner: string | null;
  onNewGame: () => void;
}

export function GameOverScreen({ winner, onNewGame }: GameOverScreenProps) {
  return (
    <div className="screen center-screen gameover-screen">
      <h1>{winner ? `🏆 ${winner} wins!` : 'Everyone is scrap. Nobody wins.'}</h1>
      <button className="primary big" onClick={onNewGame} data-testid="play-again">
        Play again
      </button>
    </div>
  );
}
