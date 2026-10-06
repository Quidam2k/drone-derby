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

/** Picker choices; null = untimed (the default). */
export const TIMER_OPTIONS: { label: string; ms: number | null }[] = [
  { label: 'Off', ms: null },
  { label: '1 min', ms: 60_000 },
  { label: '2 min', ms: 120_000 },
  { label: '5 min', ms: 300_000 },
  { label: '1 h', ms: 3_600_000 },
  { label: '24 h', ms: 86_400_000 },
];

/** "2 min", "24 h" — a picker label when it is one, else the countdown format. */
export function timerLabel(ms: number): string {
  return TIMER_OPTIONS.find((o) => o.ms === ms)?.label ?? formatRemaining(ms);
}

/** Turn-timer choice for the create form and the host's game lobby. */
export function TimerPicker({
  value,
  onChange,
  disabled,
}: {
  value: number | null;
  onChange: (ms: number | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="timer-picker" data-testid="timer-picker">
      <span>Turn timer:</span>
      {TIMER_OPTIONS.map((o) => (
        <button
          key={o.label}
          type="button"
          className={value === o.ms ? 'selected' : ''}
          disabled={disabled}
          onClick={() => onChange(o.ms)}
          data-testid={`timer-${o.ms ?? 'off'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
