import { io, Socket } from 'socket.io-client'
import { store } from '@/store'
import { 
  updateGameState,
  updateCurrentPlayer,
  setConnectionStatus,
  startTurnExecution,
  addTurnResult,
  completeTurnExecution,
  updatePlayerReady,
  setTimeRemaining
} from '@/store/slices/gameSlice'
import { addRealtimeNotification } from '@/store/slices/notificationSlice'
import { addNotification } from '@/store/slices/uiSlice'
import {
  WebSocketMessage,
  GameUpdateMessage,
  TurnReadyMessage,
  ExecutionCompleteMessage,
  PlayerJoinedMessage,
  PlayerLeftMessage,
  NotificationMessage
} from '@/shared/types/api'

export class WebSocketService {
  private socket: Socket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private isConnecting = false
  
  connect(token?: string): void {
    if (this.socket?.connected || this.isConnecting) {
      return
    }
    
    this.isConnecting = true
    
    const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001'
    
    this.socket = io(WS_URL, {
      auth: {
        token: token || store.getState().auth.tokens?.accessToken
      },
      autoConnect: true,
      timeout: 20000,
      transports: ['websocket', 'polling'],
    })
    
    this.setupEventListeners()
  }
  
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    this.isConnecting = false
    this.reconnectAttempts = 0
    store.dispatch(setConnectionStatus(false))
  }
  
  private setupEventListeners(): void {
    if (!this.socket) return
    
    // Connection events
    this.socket.on('connect', () => {
      console.log('WebSocket connected')
      this.isConnecting = false
      this.reconnectAttempts = 0
      store.dispatch(setConnectionStatus(true))
      
      store.dispatch(addNotification({
        type: 'success',
        title: 'Connected',
        message: 'Real-time updates enabled',
      }))
    })
    
    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason)
      store.dispatch(setConnectionStatus(false))
      
      if (reason === 'io server disconnect' || reason === 'io client disconnect') {
        // Manual disconnect, don't reconnect
        return
      }
      
      // Attempt to reconnect
      this.attemptReconnect()
    })
    
    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error)
      this.isConnecting = false
      store.dispatch(setConnectionStatus(false))
      
      this.attemptReconnect()
    })
    
    // Game events
    this.socket.on('game_updated', (message: GameUpdateMessage) => {
      console.log('Game updated:', message.payload.gameId)
      store.dispatch(updateGameState(message.payload.game))
    })
    
    this.socket.on('turn_ready', (message: TurnReadyMessage) => {
      console.log('Turn ready:', message.payload)
      store.dispatch(startTurnExecution())
      
      store.dispatch(addNotification({
        type: 'info',
        title: 'Turn Executing',
        message: `Turn ${message.payload.turn} is now executing`,
      }))
    })
    
    this.socket.on('execution_complete', (message: ExecutionCompleteMessage) => {
      console.log('Execution complete:', message.payload)
      store.dispatch(addTurnResult(message.payload.results))
      store.dispatch(completeTurnExecution())
      
      store.dispatch(addNotification({
        type: 'success',
        title: 'Turn Complete',
        message: `Turn ${message.payload.turn} execution finished`,
      }))
    })
    
    this.socket.on('player_joined', (message: PlayerJoinedMessage) => {
      console.log('Player joined:', message.payload)
      
      store.dispatch(addNotification({
        type: 'info',
        title: 'Player Joined',
        message: `${message.payload.player.name} joined the game`,
      }))
    })
    
    this.socket.on('player_left', (message: PlayerLeftMessage) => {
      console.log('Player left:', message.payload)
      
      store.dispatch(addNotification({
        type: 'warning',
        title: 'Player Left',
        message: 'A player has left the game',
      }))
    })
    
    this.socket.on('player_ready', (data: { gameId: string; playerId: string; isReady: boolean }) => {
      store.dispatch(updatePlayerReady({ playerId: data.playerId, isReady: data.isReady }))
    })
    
    this.socket.on('timer_update', (data: { gameId: string; timeRemaining: number }) => {
      store.dispatch(setTimeRemaining(data.timeRemaining))
    })
    
    // Notification events
    this.socket.on('notification', (message: NotificationMessage) => {
      console.log('Notification received:', message.payload)
      store.dispatch(addRealtimeNotification(message))
      
      // Show browser notification if enabled
      const state = store.getState()
      if (state.notification.settings.soundEnabled && 'Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification(message.payload.title, {
            body: message.payload.message,
            icon: '/favicon.ico',
          })
        }
      }
    })
    
    // Error handling
    this.socket.on('error', (error: { message: string; code?: string }) => {
      console.error('WebSocket error:', error)
      
      store.dispatch(addNotification({
        type: 'error',
        title: 'Connection Error',
        message: error.message || 'WebSocket error occurred',
      }))
    })
    
    // Authentication events
    this.socket.on('auth_error', () => {
      console.error('WebSocket authentication failed')
      this.disconnect()
      
      store.dispatch(addNotification({
        type: 'error',
        title: 'Authentication Failed',
        message: 'Please log in again to enable real-time features',
      }))
    })
  }
  
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnection attempts reached')
      store.dispatch(addNotification({
        type: 'error',
        title: 'Connection Lost',
        message: 'Unable to reconnect to server. Please refresh the page.',
      }))
      return
    }
    
    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1) // Exponential backoff
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`)
    
    setTimeout(() => {
      if (!this.socket?.connected) {
        this.connect()
      }
    }, delay)
  }
  
  // Game-specific methods
  joinGameRoom(gameId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('join_game', { gameId })
    }
  }
  
  leaveGameRoom(gameId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('leave_game', { gameId })
    }
  }
  
  sendChatMessage(gameId: string, message: string): void {
    if (this.socket?.connected) {
      this.socket.emit('chat_message', { gameId, message })
    }
  }
  
  // Board editor methods
  joinEditorRoom(boardId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('join_editor', { boardId })
    }
  }
  
  leaveEditorRoom(boardId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('leave_editor', { boardId })
    }
  }
  
  sendEditorUpdate(boardId: string, update: unknown): void {
    if (this.socket?.connected) {
      this.socket.emit('editor_update', { boardId, update })
    }
  }
  
  // Utility methods
  isConnected(): boolean {
    return this.socket?.connected || false
  }
  
  getSocket(): Socket | null {
    return this.socket
  }
  
  // Ping/pong for connection monitoring
  ping(): void {
    if (this.socket?.connected) {
      this.socket.emit('ping', Date.now())
    }
  }
  
  onPong(callback: (latency: number) => void): void {
    if (this.socket) {
      this.socket.on('pong', (timestamp: number) => {
        const latency = Date.now() - timestamp
        callback(latency)
      })
    }
  }
}

export const websocketService = new WebSocketService()