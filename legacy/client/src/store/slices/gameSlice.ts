import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { Game, Player, Card, GameListItem, GameState } from '@/shared/types/game'
import { gameService } from '@/services/gameService'

export interface GameStoreState {
  // Current game state
  currentGame: Game | null
  currentPlayer: Player | null
  
  // Game list and discovery
  availableGames: GameListItem[]
  userGames: GameListItem[]
  
  // Game interaction state
  selectedCards: (Card | null)[]
  isSubmittingTurn: boolean
  canSubmitTurn: boolean
  
  // Real-time state
  isConnected: boolean
  lastUpdate: number | null
  
  // UI state
  isLoading: boolean
  error: string | null
  
  // Turn execution
  turnResults: unknown[] // Array of turn execution results
  isExecutingTurn: boolean
  
  // Player interaction
  playersReady: Record<string, boolean>
  timeRemaining: number | null
}

const initialState: GameStoreState = {
  currentGame: null,
  currentPlayer: null,
  availableGames: [],
  userGames: [],
  selectedCards: [null, null, null, null, null], // 5 registers
  isSubmittingTurn: false,
  canSubmitTurn: false,
  isConnected: false,
  lastUpdate: null,
  isLoading: false,
  error: null,
  turnResults: [],
  isExecutingTurn: false,
  playersReady: {},
  timeRemaining: null,
}

// Async thunks
export const createGame = createAsyncThunk(
  'game/createGame',
  async (gameData: { boardId: string; maxPlayers: number; name?: string; isPrivate?: boolean }, { rejectWithValue }) => {
    try {
      const game = await gameService.createGame(gameData)
      return game
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to create game')
    }
  }
)

export const joinGame = createAsyncThunk(
  'game/joinGame',
  async (gameId: string, { rejectWithValue }) => {
    try {
      const gameState = await gameService.joinGame(gameId)
      return gameState
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to join game')
    }
  }
)

export const leaveGame = createAsyncThunk(
  'game/leaveGame',
  async (gameId: string, { rejectWithValue }) => {
    try {
      await gameService.leaveGame(gameId)
      return gameId
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to leave game')
    }
  }
)

export const getGameState = createAsyncThunk(
  'game/getGameState',
  async (gameId: string, { rejectWithValue }) => {
    try {
      const gameState = await gameService.getGameState(gameId)
      return gameState
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to get game state')
    }
  }
)

export const submitTurn = createAsyncThunk(
  'game/submitTurn',
  async ({ gameId, cards }: { gameId: string; cards: Card[] }, { rejectWithValue }) => {
    try {
      await gameService.submitTurn(gameId, cards)
      return { gameId, cards }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to submit turn')
    }
  }
)

export const getAvailableGames = createAsyncThunk(
  'game/getAvailableGames',
  async (_, { rejectWithValue }) => {
    try {
      const games = await gameService.getAvailableGames()
      return games
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to get available games')
    }
  }
)

export const getUserGames = createAsyncThunk(
  'game/getUserGames',
  async (_, { rejectWithValue }) => {
    try {
      const games = await gameService.getUserGames()
      return games
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to get user games')
    }
  }
)

const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    // Card selection for programming phase
    selectCard: (state, action: PayloadAction<{ register: number; card: Card | null }>) => {
      const { register, card } = action.payload
      if (register >= 0 && register < 5) {
        state.selectedCards[register] = card
        state.canSubmitTurn = state.selectedCards.every(card => card !== null)
      }
    },
    
    clearSelectedCards: (state) => {
      state.selectedCards = [null, null, null, null, null]
      state.canSubmitTurn = false
    },
    
    // Real-time updates from WebSocket
    updateGameState: (state, action: PayloadAction<Game>) => {
      state.currentGame = action.payload
      state.lastUpdate = Date.now()
      
      // Update players ready status
      const readyStatus: Record<string, boolean> = {}
      action.payload.players.forEach(player => {
        readyStatus[player.id] = player.isReady
      })
      state.playersReady = readyStatus
    },
    
    updateCurrentPlayer: (state, action: PayloadAction<Player>) => {
      state.currentPlayer = action.payload
    },
    
    setConnectionStatus: (state, action: PayloadAction<boolean>) => {
      state.isConnected = action.payload
    },
    
    // Turn execution
    startTurnExecution: (state) => {
      state.isExecutingTurn = true
      state.canSubmitTurn = false
    },
    
    addTurnResult: (state, action: PayloadAction<unknown>) => {
      state.turnResults.push(action.payload)
    },
    
    completeTurnExecution: (state) => {
      state.isExecutingTurn = false
      state.selectedCards = [null, null, null, null, null]
      state.canSubmitTurn = false
    },
    
    // Player ready states
    updatePlayerReady: (state, action: PayloadAction<{ playerId: string; isReady: boolean }>) => {
      const { playerId, isReady } = action.payload
      state.playersReady[playerId] = isReady
    },
    
    // Timer
    setTimeRemaining: (state, action: PayloadAction<number | null>) => {
      state.timeRemaining = action.payload
    },
    
    // Error handling
    clearError: (state) => {
      state.error = null
    },
    
    // Reset game state
    resetGameState: (state) => {
      state.currentGame = null
      state.currentPlayer = null
      state.selectedCards = [null, null, null, null, null]
      state.isSubmittingTurn = false
      state.canSubmitTurn = false
      state.turnResults = []
      state.isExecutingTurn = false
      state.playersReady = {}
      state.timeRemaining = null
      state.error = null
    },
  },
  extraReducers: (builder) => {
    // Create game
    builder
      .addCase(createGame.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(createGame.fulfilled, (state, action) => {
        state.isLoading = false
        state.currentGame = action.payload
        state.error = null
      })
      .addCase(createGame.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

    // Join game
    builder
      .addCase(joinGame.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(joinGame.fulfilled, (state, action) => {
        state.isLoading = false
        state.currentGame = action.payload.game
        state.currentPlayer = action.payload.currentPlayer
        state.canSubmitTurn = action.payload.canSubmitTurn
        state.timeRemaining = action.payload.timeRemaining ?? null
        state.error = null
      })
      .addCase(joinGame.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

    // Leave game
    builder
      .addCase(leaveGame.pending, (state) => {
        state.isLoading = true
      })
      .addCase(leaveGame.fulfilled, (state) => {
        state.isLoading = false
        state.currentGame = null
        state.currentPlayer = null
        state.selectedCards = [null, null, null, null, null]
        state.canSubmitTurn = false
        state.error = null
      })
      .addCase(leaveGame.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

    // Get game state
    builder
      .addCase(getGameState.pending, (state) => {
        state.isLoading = true
      })
      .addCase(getGameState.fulfilled, (state, action) => {
        state.isLoading = false
        state.currentGame = action.payload.game
        state.currentPlayer = action.payload.currentPlayer
        state.canSubmitTurn = action.payload.canSubmitTurn
        state.timeRemaining = action.payload.timeRemaining ?? null
        state.error = null
      })
      .addCase(getGameState.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

    // Submit turn
    builder
      .addCase(submitTurn.pending, (state) => {
        state.isSubmittingTurn = true
        state.error = null
      })
      .addCase(submitTurn.fulfilled, (state) => {
        state.isSubmittingTurn = false
        state.canSubmitTurn = false
        state.error = null
      })
      .addCase(submitTurn.rejected, (state, action) => {
        state.isSubmittingTurn = false
        state.error = action.payload as string
      })

    // Get available games
    builder
      .addCase(getAvailableGames.pending, (state) => {
        state.isLoading = true
      })
      .addCase(getAvailableGames.fulfilled, (state, action) => {
        state.isLoading = false
        state.availableGames = action.payload
        state.error = null
      })
      .addCase(getAvailableGames.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

    // Get user games
    builder
      .addCase(getUserGames.pending, (state) => {
        state.isLoading = true
      })
      .addCase(getUserGames.fulfilled, (state, action) => {
        state.isLoading = false
        state.userGames = action.payload
        state.error = null
      })
      .addCase(getUserGames.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
  },
})

export const {
  selectCard,
  clearSelectedCards,
  updateGameState,
  updateCurrentPlayer,
  setConnectionStatus,
  startTurnExecution,
  addTurnResult,
  completeTurnExecution,
  updatePlayerReady,
  setTimeRemaining,
  clearError,
  resetGameState,
} = gameSlice.actions

export default gameSlice