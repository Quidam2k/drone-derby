export type Direction = 'north' | 'south' | 'east' | 'west';

export type GamePhase = 'waiting' | 'programming' | 'executing' | 'complete';

export type CardType = 'move1' | 'move2' | 'move3' | 'backup' | 'turnLeft' | 'turnRight' | 'uTurn';

export type TileType = 'floor' | 'wall' | 'conveyorNormal' | 'conveyorFast' | 'checkpoint' | 'start';

export interface Position {
  x: number;
  y: number;
}

export interface Card {
  id: string;
  type: CardType;
  priority: number;
  register?: number;
}

export interface Tile {
  type: TileType;
  direction?: Direction;
  checkpointNumber?: number;
}

export interface Robot {
  id?: string;
  playerId: string;
  position: Position;
  facing: Direction;
  checkpointsReached: number[];
}

export interface Player {
  id: string;
  name: string;
  playerIndex?: number;
  isReady: boolean;
  lastSeen: Date;
  hand?: Card[];
  selectedCards?: (Card | null)[];
}

export interface Board {
  id: string;
  name: string;
  size: { width: number; height: number };
  tiles: Tile[][];
  checkpoints: Array<{ id: number; position: Position }>;
  startPositions: Position[];
  createdBy: string;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  tiles: Tile[][];
  previewImage: string;
  createdBy: string;
  isPublic: boolean;
  tags: string[];
  rating: number;
  downloads: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Game {
  id: string;
  name?: string;
  players?: Player[];
  board?: Board;
  currentTurn: number;
  phase: GamePhase;
  turnSubmissions?: Map<string, Card[]>;
  createdAt: Date;
  lastActivity: Date;
  createdBy?: string;
  maxPlayers: number;
}

export interface GameState {
  game: Game;
  currentPlayer?: Player;
  canSubmitTurn: boolean;
  timeRemaining?: number;
}

export interface TurnExecution {
  register: number;
  movements: Array<{
    playerId: string;
    fromPosition: Position;
    toPosition: Position;
    facing: Direction;
    card: Card;
    collisions: string[];
    pushedRobots: string[];
  }>;
  conveyorEffects: Array<{
    playerId: string;
    fromPosition: Position;
    toPosition: Position;
  }>;
  checkpointsClaimed: Array<{
    playerId: string;
    checkpointId: number;
  }>;
}

export interface GameResult {
  gameId: string;
  winnerId?: string;
  finalPositions: Array<{
    playerId: string;
    position: Position;
    checkpointsReached: number[];
  }>;
  totalTurns: number;
  duration: number;
  completedAt: Date;
}

export interface GameListItem {
  id: string;
  name?: string;
  boardName?: string;
  playerCount: number;
  maxPlayers: number;
  phase: GamePhase;
  createdAt: Date;
  lastActivity: Date;
}