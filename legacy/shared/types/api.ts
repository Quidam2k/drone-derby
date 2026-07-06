import { Game, Board, Template, Player, Card, GameResult } from './game';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface User {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatar?: string;
  createdAt: Date;
  lastLoginAt?: Date;
  stats: {
    gamesPlayed: number;
    gamesWon: number;
    winRate: number;
    averageTurns: number;
    totalPlayTime: number;
  };
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  displayName: string;
}

export interface CreateGameRequest {
  boardId: string;
  maxPlayers: number;
  name?: string;
  isPrivate?: boolean;
  password?: string;
}

export interface JoinGameRequest {
  gameId: string;
  password?: string;
}

export interface SubmitTurnRequest {
  gameId: string;
  cards: Card[];
}

export interface CreateBoardRequest {
  name: string;
  tiles: Array<Array<{ type: string; direction?: string; checkpointNumber?: number }>>;
  checkpoints: Array<{ id: number; position: { x: number; y: number } }>;
  startPositions: Array<{ x: number; y: number }>;
  isPublic: boolean;
}

export interface UpdateBoardRequest {
  name?: string;
  tiles?: Array<Array<{ type: string; direction?: string; checkpointNumber?: number }>>;
  checkpoints?: Array<{ id: number; position: { x: number; y: number } }>;
  startPositions?: Array<{ x: number; y: number }>;
  isPublic?: boolean;
}

export interface CreateTemplateRequest {
  name: string;
  description: string;
  width: number;
  height: number;
  tiles: Array<Array<{ type: string; direction?: string; checkpointNumber?: number }>>;
  isPublic: boolean;
  tags: string[];
}

export interface SearchBoardsRequest {
  query?: string;
  createdBy?: string;
  isPublic?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'createdAt' | 'rating';
  sortOrder?: 'asc' | 'desc';
}

export interface SearchTemplatesRequest {
  query?: string;
  tags?: string[];
  createdBy?: string;
  isPublic?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'createdAt' | 'rating' | 'downloads';
  sortOrder?: 'asc' | 'desc';
}

export interface GameListItem {
  id: string;
  name?: string;
  boardName: string;
  playerCount: number;
  maxPlayers: number;
  phase: string;
  currentTurn: number;
  createdAt: Date;
  lastActivity: Date;
  isPrivate: boolean;
}

export interface BoardListItem {
  id: string;
  name: string;
  createdBy: string;
  createdByName: string;
  isPublic: boolean;
  rating: number;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateListItem {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  createdBy: string;
  createdByName: string;
  isPublic: boolean;
  tags: string[];
  rating: number;
  downloads: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebSocketMessage {
  type: string;
  payload: unknown;
  timestamp: number;
}

export interface GameUpdateMessage extends WebSocketMessage {
  type: 'game_updated';
  payload: {
    gameId: string;
    game: Game;
  };
}

export interface TurnReadyMessage extends WebSocketMessage {
  type: 'turn_ready';
  payload: {
    gameId: string;
    turn: number;
  };
}

export interface ExecutionCompleteMessage extends WebSocketMessage {
  type: 'execution_complete';
  payload: {
    gameId: string;
    turn: number;
    results: unknown;
  };
}

export interface PlayerJoinedMessage extends WebSocketMessage {
  type: 'player_joined';
  payload: {
    gameId: string;
    player: Player;
  };
}

export interface PlayerLeftMessage extends WebSocketMessage {
  type: 'player_left';
  payload: {
    gameId: string;
    playerId: string;
  };
}

export interface NotificationMessage extends WebSocketMessage {
  type: 'notification';
  payload: {
    id: string;
    title: string;
    message: string;
    level: 'info' | 'success' | 'warning' | 'error';
    gameId?: string;
    userId?: string;
  };
}