// Pass-the-device gate between seats so hands stay secret.

interface HandoffScreenProps {
  name: string;
  seat: number;
  turn: number;
  onReady: () => void;
}

export function HandoffScreen({ name, seat, turn, onReady }: HandoffScreenProps) {
  return (
    <div className="screen center-screen handoff-screen">
      <p className="handoff-turn">Turn {turn}</p>
      <h1>
        Pass to{' '}
        <span style={{ color: `var(--player-${seat})` }}>{name}</span>
      </h1>
      <p className="handoff-hint">No peeking at other hands!</p>
      <button className="primary big" onClick={onReady} data-testid="handoff-ready">
        I'm {name} — show my hand
      </button>
    </div>
  );
}
