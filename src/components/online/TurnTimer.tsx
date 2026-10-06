// Shows the time remaining in the current turn, updating more often near expiry.

import { useEffect, useState } from 'react';

export function formatRemaining(ms: number): string {
  if (ms <= 0) return '0:00';
  if (ms >= 172_800_000) return `${Math.floor(ms / 86_400_000)} d`;
  if (ms >= 3_600_000) return `${Math.floor(ms / 3_600_000)} h`;

  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function TurnTimer({ deadline, className }: { deadline: number | null; className?: string }) {
  const [now, setNow] = useState(() => Date.now());
  const remaining = deadline === null ? 0 : Math.max(0, deadline - now);
  const underHour = remaining < 3_600_000;

  useEffect(() => {
    if (deadline === null) return;

    const interval = setInterval(() => setNow(Date.now()), underHour ? 1000 : 30_000);
    return () => clearInterval(interval);
  }, [deadline, underHour]);

  if (deadline === null) return null;

  return (
    <span
      className={`turn-timer${remaining < 60_000 ? ' urgent' : ''}${className ? ` ${className}` : ''}`}
      data-testid="turn-timer"
      title="Time left this turn — empty registers get random cards when it runs out"
    >
      {'⏱ ' + formatRemaining(remaining) + (remaining >= 3_600_000 ? ' left' : '')}
    </span>
  );
}
