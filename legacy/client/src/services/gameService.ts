import { Game, Card, GameListItem, GameState } from '@/shared/types/game'
import { 
  ApiResponse,
  CreateGameRequest,
  JoinGameRequest,
  SubmitTurnRequest,
  PaginatedResponse
} from '@/shared/types/api'
import { apiClient } from './api'

export class GameService {
  async createGame(gameData: {
    boardId: string
    maxPlayers: number
    name?: string
    isPrivate?: boolean
    password?: string
  }): Promise<Game> {
    const response = await apiClient.post<ApiResponse<Game>>('/games', gameData)
    
    if (response.success && response.data) {
      return response.data
    }
    
    throw new Error(response.error || 'Failed to create game')
  }
  
  async joinGame(gameId: string, password?: string): Promise<GameState> {
    const response = await apiClient.post<ApiResponse<GameState>>(
      `/games/${gameId}/join`,
      { password }
    )
    
    if (response.success && response.data) {
      return response.data
    }
    
    throw new Error(response.error || 'Failed to join game')
  }
  
  async leaveGame(gameId: string): Promise<void> {
    const response = await apiClient.post<ApiResponse<void>>(`/games/${gameId}/leave`)
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to leave game')
    }
  }
  
  async getGameState(gameId: string): Promise<GameState> {
    const response = await apiClient.get<ApiResponse<GameState>>(`/games/${gameId}`)
    
    if (response.success && response.data) {
      return response.data
    }
    
    throw new Error(response.error || 'Failed to get game state')
  }
  
  async submitTurn(gameId: string, cards: Card[]): Promise<void> {
    if (cards.length !== 5) {
      throw new Error('Must submit exactly 5 cards')
    }
    
    const response = await apiClient.post<ApiResponse<void>>(
      `/games/${gameId}/turn`,
      { cards }
    )
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to submit turn')
    }
  }
  
  async getAvailableGames(options: {
    page?: number
    limit?: number
    boardId?: string
    maxPlayers?: number
  } = {}): Promise<PaginatedResponse<GameListItem>> {
    const params = new URLSearchParams()
    
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString())
      }
    })
    
    const response = await apiClient.get<ApiResponse<PaginatedResponse<GameListItem>>>(
      `/games/available?${params.toString()}`
    )
    
    if (response.success && response.data) {
      return response.data
    }
    
    throw new Error(response.error || 'Failed to get available games')
  }
  
  async getUserGames(options: {
    page?: number
    limit?: number
    status?: 'active' | 'completed' | 'all'
  } = {}): Promise<PaginatedResponse<GameListItem>> {
    const params = new URLSearchParams()
    
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString())
      }
    })
    
    const response = await apiClient.get<ApiResponse<PaginatedResponse<GameListItem>>>(
      `/games/user?${params.toString()}`
    )
    
    if (response.success && response.data) {
      return response.data
    }
    
    throw new Error(response.error || 'Failed to get user games')
  }
  
  async getTurnHistory(gameId: string): Promise<Array<{
    turnNumber: number
    playerSubmissions: Record<string, Card[]>
    executionResults: unknown[]
    completedAt: Date
  }>> {
    const response = await apiClient.get<ApiResponse<Array<{
      turnNumber: number
      playerSubmissions: Record<string, Card[]>
      executionResults: unknown[]
      completedAt: Date
    }>>>(`/games/${gameId}/history`)
    
    if (response.success && response.data) {
      return response.data
    }
    
    throw new Error(response.error || 'Failed to get turn history')
  }
  
  async getGameResults(gameId: string): Promise<{
    winnerId?: string
    finalPositions: Array<{
      playerId: string
      position: { x: number; y: number }
      checkpointsReached: number[]
    }>
    totalTurns: number
    duration: number
    completedAt: Date
  }> {
    const response = await apiClient.get<ApiResponse<{
      winnerId?: string
      finalPositions: Array<{
        playerId: string
        position: { x: number; y: number }
        checkpointsReached: number[]
      }>
      totalTurns: number
      duration: number
      completedAt: Date
    }>>(`/games/${gameId}/results`)
    
    if (response.success && response.data) {
      return response.data
    }
    
    throw new Error(response.error || 'Failed to get game results')
  }
  
  async startGame(gameId: string): Promise<void> {
    const response = await apiClient.post<ApiResponse<void>>(`/games/${gameId}/start`)
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to start game')
    }
  }
  
  async cancelGame(gameId: string): Promise<void> {
    const response = await apiClient.post<ApiResponse<void>>(`/games/${gameId}/cancel`)
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to cancel game')
    }
  }
  
  async setReady(gameId: string, isReady: boolean): Promise<void> {
    const response = await apiClient.post<ApiResponse<void>>(
      `/games/${gameId}/ready`,
      { isReady }
    )
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to set ready status')
    }
  }
  
  async drawCards(gameId: string): Promise<Card[]> {
    const response = await apiClient.post<ApiResponse<Card[]>>(`/games/${gameId}/draw`)
    
    if (response.success && response.data) {
      return response.data
    }
    
    throw new Error(response.error || 'Failed to draw cards')
  }
  
  async getPowerDownStatus(gameId: string): Promise<{
    canPowerDown: boolean
    isPoweredDown: boolean
    powerDownTurns: number
  }> {
    const response = await apiClient.get<ApiResponse<{
      canPowerDown: boolean
      isPoweredDown: boolean
      powerDownTurns: number
    }>>(`/games/${gameId}/power-down`)
    
    if (response.success && response.data) {
      return response.data
    }
    
    throw new Error(response.error || 'Failed to get power down status')
  }
  
  async togglePowerDown(gameId: string): Promise<void> {
    const response = await apiClient.post<ApiResponse<void>>(`/games/${gameId}/power-down`)
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to toggle power down')
    }
  }
  
  async spectateGame(gameId: string): Promise<GameState> {
    const response = await apiClient.post<ApiResponse<GameState>>(
      `/games/${gameId}/spectate`
    )
    
    if (response.success && response.data) {
      return response.data
    }
    
    throw new Error(response.error || 'Failed to spectate game')
  }
  
  async getGameStats(): Promise<{
    totalGames: number
    activeGames: number
    completedGames: number
    averageGameDuration: number
    popularBoards: Array<{
      boardId: string
      boardName: string
      gameCount: number
    }>
  }> {
    const response = await apiClient.get<ApiResponse<{
      totalGames: number
      activeGames: number
      completedGames: number
      averageGameDuration: number
      popularBoards: Array<{
        boardId: string
        boardName: string
        gameCount: number
      }>
    }>>('/games/stats')
    
    if (response.success && response.data) {
      return response.data
    }
    
    throw new Error(response.error || 'Failed to get game stats')
  }
}

export const gameService = new GameService()