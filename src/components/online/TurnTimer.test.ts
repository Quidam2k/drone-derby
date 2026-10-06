import { describe, expect, it } from 'vitest';
import { formatRemaining, timerLabel } from './TurnTimer';

describe('formatRemaining', () => {
  it('shows m:ss under an hour', () => {
    expect(formatRemaining(0)).toBe('0:00');
    expect(formatRemaining(-5)).toBe('0:00');
    expect(formatRemaining(59_000)).toBe('0:59');
    expect(formatRemaining(75_000)).toBe('1:15');
    expect(formatRemaining(3_599_000)).toBe('59:59');
  });
  it('shows whole hours, then whole days', () => {
    expect(formatRemaining(3_600_000)).toBe('1 h');
    expect(formatRemaining(18.5 * 3_600_000)).toBe('18 h');
    expect(formatRemaining(47.9 * 3_600_000)).toBe('47 h');
    expect(formatRemaining(48 * 3_600_000)).toBe('2 d');
    expect(formatRemaining(7 * 86_400_000)).toBe('7 d');
  });
});

describe('timerLabel', () => {
  it('uses the picker label when there is one', () => {
    expect(timerLabel(120_000)).toBe('2 min');
    expect(timerLabel(86_400_000)).toBe('24 h');
    expect(timerLabel(90_000)).toBe('1:30');
  });
});
