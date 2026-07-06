import { Board, Tile } from '@/shared/types/game'
import { 
  BoardListItem, 
  PaginatedResponse, 
  ApiResponse,
  CreateBoardRequest,
  UpdateBoardRequest,
  SearchBoardsRequest
} from '@/shared/types/api'
import { apiClient } from './api'

export class BoardService {
  async getBoard(boardId: string): Promise<Board> {
    const response = await apiClient.get<ApiResponse<Board>>(`/boards/${boardId}`)
    
    if (response.success && response.data) {
      return response.data
    }
    
    throw new Error(response.error || 'Failed to get board')
  }
  
  async createBoard(boardData: {
    name: string
    tiles: Tile[][]
    checkpoints: Array<{ id: number; position: { x: number; y: number } }>
    startPositions: Array<{ x: number; y: number }>
    isPublic?: boolean
    description?: string
  }): Promise<Board> {
    const response = await apiClient.post<ApiResponse<Board>>('/boards', boardData)
    
    if (response.success && response.data) {
      return response.data
    }
    
    throw new Error(response.error || 'Failed to create board')
  }
  
  async updateBoard(boardId: string, boardData: {
    name?: string
    tiles?: Tile[][]
    checkpoints?: Array<{ id: number; position: { x: number; y: number } }>
    startPositions?: Array<{ x: number; y: number }>
    isPublic?: boolean
    description?: string
  }): Promise<Board> {
    const response = await apiClient.put<ApiResponse<Board>>(`/boards/${boardId}`, boardData)
    
    if (response.success && response.data) {
      return response.data
    }
    
    throw new Error(response.error || 'Failed to update board')
  }
  
  async deleteBoard(boardId: string): Promise<void> {
    const response = await apiClient.delete<ApiResponse<void>>(`/boards/${boardId}`)
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to delete board')
    }
  }
  
  async getPublicBoards(options: {
    page?: number
    limit?: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  } = {}): Promise<PaginatedResponse<BoardListItem>> {
    const params = new URLSearchParams()
    
    if (options.page) params.append('page', options.page.toString())
    if (options.limit) params.append('limit', options.limit.toString())
    if (options.sortBy) params.append('sortBy', options.sortBy)
    if (options.sortOrder) params.append('sortOrder', options.sortOrder)
    
    const response = await apiClient.get<ApiResponse<PaginatedResponse<BoardListItem>>>(
      `/boards/public?${params.toString()}`
    )
    
    if (response.success && response.data) {
      return response.data
    }
    
    throw new Error(response.error || 'Failed to get public boards')
  }
  
  async getUserBoards(options: {
    page?: number
    limit?: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  } = {}): Promise<PaginatedResponse<BoardListItem>> {
    const params = new URLSearchParams()
    
    if (options.page) params.append('page', options.page.toString())
    if (options.limit) params.append('limit', options.limit.toString())
    if (options.sortBy) params.append('sortBy', options.sortBy)
    if (options.sortOrder) params.append('sortOrder', options.sortOrder)
    
    const response = await apiClient.get<ApiResponse<PaginatedResponse<BoardListItem>>>(
      `/boards/user?${params.toString()}`
    )
    
    if (response.success && response.data) {
      return response.data
    }
    
    throw new Error(response.error || 'Failed to get user boards')
  }
  
  async searchBoards(searchParams: {
    query?: string
    createdBy?: string
    isPublic?: boolean
    page?: number
    limit?: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  }): Promise<PaginatedResponse<BoardListItem>> {
    const params = new URLSearchParams()
    
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString())
      }
    })
    
    const response = await apiClient.get<ApiResponse<PaginatedResponse<BoardListItem>>>(
      `/boards/search?${params.toString()}`
    )
    
    if (response.success && response.data) {
      return response.data
    }
    
    throw new Error(response.error || 'Failed to search boards')
  }
  
  async duplicateBoard(boardId: string, newName?: string): Promise<Board> {
    const response = await apiClient.post<ApiResponse<Board>>(
      `/boards/${boardId}/duplicate`,
      { newName }
    )
    
    if (response.success && response.data) {
      return response.data
    }
    
    throw new Error(response.error || 'Failed to duplicate board')
  }
  
  async validateBoard(boardData: {
    tiles: Tile[][]
    checkpoints: Array<{ id: number; position: { x: number; y: number } }>
    startPositions: Array<{ x: number; y: number }>
  }): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
    const response = await apiClient.post<ApiResponse<{
      valid: boolean
      errors: string[]
      warnings: string[]
    }>>('/boards/validate', boardData)
    
    if (response.success && response.data) {
      return response.data
    }
    
    throw new Error(response.error || 'Failed to validate board')
  }
  
  async exportBoard(boardId: string, format: 'json' | 'png' | 'svg'): Promise<Blob> {
    const response = await apiClient.get(`/boards/${boardId}/export?format=${format}`, {
      responseType: 'blob'
    })
    
    return new Blob([response])
  }
  
  async importBoard(file: File): Promise<Board> {
    const formData = new FormData()
    formData.append('board', file)
    
    const response = await apiClient.post<ApiResponse<Board>>('/boards/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    
    if (response.success && response.data) {
      return response.data
    }
    
    throw new Error(response.error || 'Failed to import board')
  }
  
  async rateBoard(boardId: string, rating: number): Promise<void> {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5')
    }
    
    const response = await apiClient.post<ApiResponse<void>>(
      `/boards/${boardId}/rate`,
      { rating }
    )
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to rate board')
    }
  }
  
  async getBoardStats(boardId: string): Promise<{
    usageCount: number
    rating: number
    ratingCount: number
    averageCompletionTime: number
    difficulty: number
  }> {
    const response = await apiClient.get<ApiResponse<{
      usageCount: number
      rating: number
      ratingCount: number
      averageCompletionTime: number
      difficulty: number
    }>>(`/boards/${boardId}/stats`)
    
    if (response.success && response.data) {
      return response.data
    }
    
    throw new Error(response.error || 'Failed to get board stats')
  }
  
  async getFeaturedBoards(): Promise<BoardListItem[]> {
    const response = await apiClient.get<ApiResponse<BoardListItem[]>>('/boards/featured')
    
    if (response.success && response.data) {
      return response.data
    }
    
    throw new Error(response.error || 'Failed to get featured boards')
  }
  
  async getRecentBoards(limit: number = 10): Promise<BoardListItem[]> {
    const response = await apiClient.get<ApiResponse<BoardListItem[]>>(
      `/boards/recent?limit=${limit}`
    )
    
    if (response.success && response.data) {
      return response.data
    }
    
    throw new Error(response.error || 'Failed to get recent boards')
  }
}

export const boardService = new BoardService()