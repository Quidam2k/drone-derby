import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { Board, Tile } from '@/shared/types/game'
import { BoardListItem, PaginatedResponse } from '@/shared/types/api'
import { boardService } from '@/services/boardService'

export interface BoardState {
  // Current board for editing/viewing
  currentBoard: Board | null
  
  // Board discovery and browsing
  publicBoards: BoardListItem[]
  userBoards: BoardListItem[]
  searchResults: PaginatedResponse<BoardListItem> | null
  
  // Editor state
  editorBoard: {
    tiles: Tile[][]
    checkpoints: Array<{ id: number; position: { x: number; y: number } }>
    startPositions: Array<{ x: number; y: number }>
  } | null
  hasUnsavedChanges: boolean
  
  // UI state
  isLoading: boolean
  error: string | null
  
  // Pagination
  currentPage: number
  totalPages: number
}

const initialState: BoardState = {
  currentBoard: null,
  publicBoards: [],
  userBoards: [],
  searchResults: null,
  editorBoard: null,
  hasUnsavedChanges: false,
  isLoading: false,
  error: null,
  currentPage: 1,
  totalPages: 1,
}

// Helper function to create empty board
const createEmptyBoard = (): Tile[][] => {
  const board: Tile[][] = []
  for (let y = 0; y < 10; y++) {
    const row: Tile[] = []
    for (let x = 0; x < 10; x++) {
      row.push({ type: 'floor' })
    }
    board.push(row)
  }
  return board
}

// Async thunks
export const loadBoard = createAsyncThunk(
  'board/loadBoard',
  async (boardId: string, { rejectWithValue }) => {
    try {
      const board = await boardService.getBoard(boardId)
      return board
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to load board')
    }
  }
)

export const saveBoard = createAsyncThunk(
  'board/saveBoard',
  async ({ 
    boardData, 
    boardId 
  }: { 
    boardData: {
      name: string
      tiles: Tile[][]
      checkpoints: Array<{ id: number; position: { x: number; y: number } }>
      startPositions: Array<{ x: number; y: number }>
      isPublic?: boolean
      description?: string
    }
    boardId?: string 
  }, { rejectWithValue }) => {
    try {
      if (boardId) {
        const board = await boardService.updateBoard(boardId, boardData)
        return board
      } else {
        const board = await boardService.createBoard(boardData)
        return board
      }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to save board')
    }
  }
)

export const deleteBoard = createAsyncThunk(
  'board/deleteBoard',
  async (boardId: string, { rejectWithValue }) => {
    try {
      await boardService.deleteBoard(boardId)
      return boardId
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to delete board')
    }
  }
)

export const getPublicBoards = createAsyncThunk(
  'board/getPublicBoards',
  async ({ page = 1, limit = 20 }: { page?: number; limit?: number }, { rejectWithValue }) => {
    try {
      const result = await boardService.getPublicBoards({ page, limit })
      return result
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to get public boards')
    }
  }
)

export const getUserBoards = createAsyncThunk(
  'board/getUserBoards',
  async ({ page = 1, limit = 20 }: { page?: number; limit?: number }, { rejectWithValue }) => {
    try {
      const result = await boardService.getUserBoards({ page, limit })
      return result
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to get user boards')
    }
  }
)

export const searchBoards = createAsyncThunk(
  'board/searchBoards',
  async (searchParams: {
    query?: string
    isPublic?: boolean
    page?: number
    limit?: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  }, { rejectWithValue }) => {
    try {
      const result = await boardService.searchBoards(searchParams)
      return result
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to search boards')
    }
  }
)

export const duplicateBoard = createAsyncThunk(
  'board/duplicateBoard',
  async ({ boardId, newName }: { boardId: string; newName?: string }, { rejectWithValue }) => {
    try {
      const board = await boardService.duplicateBoard(boardId, newName)
      return board
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to duplicate board')
    }
  }
)

const boardSlice = createSlice({
  name: 'board',
  initialState,
  reducers: {
    // Editor actions
    createNewBoard: (state) => {
      state.editorBoard = {
        tiles: createEmptyBoard(),
        checkpoints: [],
        startPositions: [],
      }
      state.hasUnsavedChanges = false
      state.currentBoard = null
    },
    
    updateTile: (state, action: PayloadAction<{ x: number; y: number; tile: Tile }>) => {
      if (!state.editorBoard) return
      
      const { x, y, tile } = action.payload
      if (x >= 0 && x < 10 && y >= 0 && y < 10) {
        state.editorBoard.tiles[y][x] = tile
        state.hasUnsavedChanges = true
      }
    },
    
    updateMultipleTiles: (state, action: PayloadAction<Array<{ x: number; y: number; tile: Tile }>>) => {
      if (!state.editorBoard) return
      
      action.payload.forEach(({ x, y, tile }) => {
        if (x >= 0 && x < 10 && y >= 0 && y < 10) {
          state.editorBoard!.tiles[y][x] = tile
        }
      })
      state.hasUnsavedChanges = true
    },
    
    addCheckpoint: (state, action: PayloadAction<{ x: number; y: number }>) => {
      if (!state.editorBoard) return
      
      const { x, y } = action.payload
      const nextId = Math.max(0, ...state.editorBoard.checkpoints.map(cp => cp.id)) + 1
      
      state.editorBoard.checkpoints.push({
        id: nextId,
        position: { x, y }
      })
      
      // Update the tile
      state.editorBoard.tiles[y][x] = {
        type: 'checkpoint',
        checkpointNumber: nextId
      }
      
      state.hasUnsavedChanges = true
    },
    
    removeCheckpoint: (state, action: PayloadAction<{ x: number; y: number }>) => {
      if (!state.editorBoard) return
      
      const { x, y } = action.payload
      const index = state.editorBoard.checkpoints.findIndex(
        cp => cp.position.x === x && cp.position.y === y
      )
      
      if (index !== -1) {
        state.editorBoard.checkpoints.splice(index, 1)
        state.editorBoard.tiles[y][x] = { type: 'floor' }
        state.hasUnsavedChanges = true
      }
    },
    
    addStartPosition: (state, action: PayloadAction<{ x: number; y: number }>) => {
      if (!state.editorBoard) return
      
      const { x, y } = action.payload
      
      // Limit to 4 start positions
      if (state.editorBoard.startPositions.length >= 4) return
      
      // Check if position already exists
      const exists = state.editorBoard.startPositions.some(
        pos => pos.x === x && pos.y === y
      )
      
      if (!exists) {
        state.editorBoard.startPositions.push({ x, y })
        state.editorBoard.tiles[y][x] = { type: 'start' }
        state.hasUnsavedChanges = true
      }
    },
    
    removeStartPosition: (state, action: PayloadAction<{ x: number; y: number }>) => {
      if (!state.editorBoard) return
      
      const { x, y } = action.payload
      const index = state.editorBoard.startPositions.findIndex(
        pos => pos.x === x && pos.y === y
      )
      
      if (index !== -1) {
        state.editorBoard.startPositions.splice(index, 1)
        state.editorBoard.tiles[y][x] = { type: 'floor' }
        state.hasUnsavedChanges = true
      }
    },
    
    clearBoard: (state) => {
      if (!state.editorBoard) return
      
      state.editorBoard = {
        tiles: createEmptyBoard(),
        checkpoints: [],
        startPositions: [],
      }
      state.hasUnsavedChanges = true
    },
    
    // Navigation and pagination
    setCurrentPage: (state, action: PayloadAction<number>) => {
      state.currentPage = action.payload
    },
    
    // Error handling
    clearError: (state) => {
      state.error = null
    },
    
    // Reset editor state
    resetEditor: (state) => {
      state.editorBoard = null
      state.hasUnsavedChanges = false
      state.currentBoard = null
    },
    
    // Mark changes as saved
    markSaved: (state) => {
      state.hasUnsavedChanges = false
    },
  },
  extraReducers: (builder) => {
    // Load board
    builder
      .addCase(loadBoard.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(loadBoard.fulfilled, (state, action) => {
        state.isLoading = false
        state.currentBoard = action.payload
        state.editorBoard = {
          tiles: action.payload.tiles,
          checkpoints: action.payload.checkpoints,
          startPositions: action.payload.startPositions,
        }
        state.hasUnsavedChanges = false
        state.error = null
      })
      .addCase(loadBoard.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

    // Save board
    builder
      .addCase(saveBoard.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(saveBoard.fulfilled, (state, action) => {
        state.isLoading = false
        state.currentBoard = action.payload
        state.hasUnsavedChanges = false
        state.error = null
      })
      .addCase(saveBoard.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

    // Delete board
    builder
      .addCase(deleteBoard.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(deleteBoard.fulfilled, (state, action) => {
        state.isLoading = false
        // Remove from user boards list
        state.userBoards = state.userBoards.filter(board => board.id !== action.payload)
        state.error = null
      })
      .addCase(deleteBoard.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

    // Get public boards
    builder
      .addCase(getPublicBoards.pending, (state) => {
        state.isLoading = true
      })
      .addCase(getPublicBoards.fulfilled, (state, action) => {
        state.isLoading = false
        state.publicBoards = action.payload.items
        state.totalPages = action.payload.totalPages
        state.error = null
      })
      .addCase(getPublicBoards.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

    // Get user boards
    builder
      .addCase(getUserBoards.pending, (state) => {
        state.isLoading = true
      })
      .addCase(getUserBoards.fulfilled, (state, action) => {
        state.isLoading = false
        state.userBoards = action.payload.items
        state.totalPages = action.payload.totalPages
        state.error = null
      })
      .addCase(getUserBoards.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

    // Search boards
    builder
      .addCase(searchBoards.pending, (state) => {
        state.isLoading = true
      })
      .addCase(searchBoards.fulfilled, (state, action) => {
        state.isLoading = false
        state.searchResults = action.payload
        state.currentPage = action.payload.page
        state.totalPages = action.payload.totalPages
        state.error = null
      })
      .addCase(searchBoards.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

    // Duplicate board
    builder
      .addCase(duplicateBoard.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(duplicateBoard.fulfilled, (state, action) => {
        state.isLoading = false
        state.userBoards.unshift(action.payload as unknown as BoardListItem)
        state.error = null
      })
      .addCase(duplicateBoard.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
  },
})

export const {
  createNewBoard,
  updateTile,
  updateMultipleTiles,
  addCheckpoint,
  removeCheckpoint,
  addStartPosition,
  removeStartPosition,
  clearBoard,
  setCurrentPage,
  clearError,
  resetEditor,
  markSaved,
} = boardSlice.actions

export default boardSlice