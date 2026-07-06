import type { CardType } from '../engine';

export const CARD_LABEL: Record<CardType, string> = {
  move1: 'Move 1',
  move2: 'Move 2',
  move3: 'Move 3',
  backUp: 'Back Up',
  turnLeft: 'Turn Left',
  turnRight: 'Turn Right',
  uTurn: 'U-Turn',
};

export const CARD_GLYPH: Record<CardType, string> = {
  move1: '↑',
  move2: '↑↑',
  move3: '↑↑↑',
  backUp: '↓',
  turnLeft: '↰',
  turnRight: '↱',
  uTurn: '⟲',
};
