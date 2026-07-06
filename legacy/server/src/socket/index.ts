import { Server as SocketIOServer } from 'socket.io'
import { Server as HttpServer } from 'http'
import { verifyToken } from '../middleware/auth'
import { logger } from '../utils/logger'

export function setupWebSocket(server: HttpServer) {
  const io = new SocketIOServer(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true,
    },
  })

  // Authentication middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token
      if (!token) {
        return next(new Error('Authentication error: No token provided'))
      }

      const decoded = verifyToken(token)
      socket.data.user = decoded
      next()
    } catch (error) {
      logger.error('Socket authentication error:', error)
      next(new Error('Authentication error: Invalid token'))
    }
  })

  io.on('connection', (socket) => {
    const userId = socket.data.user?.userId
    logger.info(`User ${userId} connected via WebSocket`)

    // Join user to their personal room for notifications
    socket.join(`user:${userId}`)

    // Handle joining game rooms
    socket.on('join-game', (gameId: string) => {
      socket.join(`game:${gameId}`)
      logger.info(`User ${userId} joined game room: ${gameId}`)
      
      // Notify other players in the game
      socket.to(`game:${gameId}`).emit('player-joined', {
        userId,
        timestamp: new Date().toISOString(),
      })
    })

    // Handle leaving game rooms
    socket.on('leave-game', (gameId: string) => {
      socket.leave(`game:${gameId}`)
      logger.info(`User ${userId} left game room: ${gameId}`)
      
      // Notify other players in the game
      socket.to(`game:${gameId}`).emit('player-left', {
        userId,
        timestamp: new Date().toISOString(),
      })
    })

    // Handle game state updates (placeholder for future implementation)
    socket.on('game-update', (data) => {
      const { gameId, ...updateData } = data
      logger.info(`Game update from user ${userId} for game ${gameId}`)
      
      // Broadcast to all players in the game except sender
      socket.to(`game:${gameId}`).emit('game-state-changed', {
        ...updateData,
        userId,
        timestamp: new Date().toISOString(),
      })
    })

    // Handle player ready status
    socket.on('player-ready', (data) => {
      const { gameId, isReady } = data
      logger.info(`User ${userId} ready status: ${isReady} for game ${gameId}`)
      
      // Broadcast to all players in the game
      io.to(`game:${gameId}`).emit('player-ready-changed', {
        userId,
        isReady,
        timestamp: new Date().toISOString(),
      })
    })

    // Handle turn submissions
    socket.on('submit-turn', async (data) => {
      const { gameId, cards } = data
      logger.info(`Turn submission from user ${userId} for game ${gameId}`)
      
      try {
        // Store turn submission in database
        // This would integrate with the game controller logic
        
        // Acknowledge receipt to the submitting player
        socket.emit('turn-acknowledged', {
          gameId,
          success: true,
          timestamp: new Date().toISOString(),
        })
        
        // Notify other players that this player has submitted
        socket.to(`game:${gameId}`).emit('player-submitted', {
          playerId: userId,
          gameId,
          timestamp: new Date().toISOString(),
        })
        
        // Check if all players have submitted and start execution if so
        // This would require checking the database for all submissions
        // For now, emit a placeholder event
        // const allSubmitted = await checkAllPlayersSubmitted(gameId)
        // if (allSubmitted) {
        //   io.to(`game:${gameId}`).emit('turn-ready', {
        //     gameId,
        //     turn: currentTurn,
        //     timestamp: new Date().toISOString(),
        //   })
        // }
        
      } catch (error) {
        logger.error('Error processing turn submission:', error)
        socket.emit('turn-acknowledged', {
          gameId,
          success: false,
          error: 'Failed to submit turn',
          timestamp: new Date().toISOString(),
        })
      }
    })

    // Handle chat messages
    socket.on('chat-message', (data) => {
      const { gameId, message } = data
      logger.info(`Chat message from user ${userId} in game ${gameId}`)
      
      // Broadcast chat message to all players in the game
      io.to(`game:${gameId}`).emit('chat-message', {
        gameId,
        playerId: userId,
        message,
        timestamp: new Date().toISOString(),
      })
    })

    // Handle typing indicators for chat
    socket.on('typing-start', (data) => {
      const { gameId } = data
      socket.to(`game:${gameId}`).emit('player-typing', {
        playerId: userId,
        gameId,
        isTyping: true,
      })
    })

    socket.on('typing-stop', (data) => {
      const { gameId } = data
      socket.to(`game:${gameId}`).emit('player-typing', {
        playerId: userId,
        gameId,
        isTyping: false,
      })
    })

    // Handle game spectating
    socket.on('spectate-game', (gameId: string) => {
      socket.join(`game:${gameId}:spectators`)
      logger.info(`User ${userId} started spectating game: ${gameId}`)
    })

    socket.on('stop-spectating', (gameId: string) => {
      socket.leave(`game:${gameId}:spectators`)
      logger.info(`User ${userId} stopped spectating game: ${gameId}`)
    })

    // Handle ping/pong for latency monitoring
    socket.on('ping', (timestamp) => {
      socket.emit('pong', timestamp)
    })

    // Handle board collaboration events (for level editor)
    socket.on('join-board-edit', (boardId: string) => {
      socket.join(`board:${boardId}`)
      logger.info(`User ${userId} joined board editing room: ${boardId}`)
    })

    socket.on('leave-board-edit', (boardId: string) => {
      socket.leave(`board:${boardId}`)
      logger.info(`User ${userId} left board editing room: ${boardId}`)
    })

    socket.on('board-change', (data) => {
      const { boardId, changes } = data
      // Broadcast board changes to other editors
      socket.to(`board:${boardId}`).emit('board-updated', {
        changes,
        userId,
        timestamp: new Date().toISOString(),
      })
    })

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      logger.info(`User ${userId} disconnected: ${reason}`)
    })

    // Handle connection errors
    socket.on('error', (error) => {
      logger.error(`Socket error for user ${userId}:`, error)
    })
  })

  return io
}

// Helper functions for emitting events from controllers
export function emitToGame(io: SocketIOServer, gameId: string, event: string, data: any) {
  io.to(`game:${gameId}`).emit(event, data)
}

export function emitToUser(io: SocketIOServer, userId: string, event: string, data: any) {
  io.to(`user:${userId}`).emit(event, data)
}

export function emitToBoardEditors(io: SocketIOServer, boardId: string, event: string, data: any) {
  io.to(`board:${boardId}`).emit(event, data)
}

export function emitToSpectators(io: SocketIOServer, gameId: string, event: string, data: any) {
  io.to(`game:${gameId}:spectators`).emit(event, data)
}

export function emitToAllInGame(io: SocketIOServer, gameId: string, event: string, data: any) {
  io.to(`game:${gameId}`).emit(event, data)
  io.to(`game:${gameId}:spectators`).emit(event, data)
}

// Game state management helpers
export function notifyGameStart(io: SocketIOServer, gameId: string, gameData: any) {
  emitToAllInGame(io, gameId, 'game-started', {
    gameId,
    ...gameData,
    timestamp: new Date().toISOString(),
  })
}

export function notifyTurnExecution(io: SocketIOServer, gameId: string, turnData: any) {
  emitToAllInGame(io, gameId, 'turn-executing', {
    gameId,
    ...turnData,
    timestamp: new Date().toISOString(),
  })
}

export function notifyGameComplete(io: SocketIOServer, gameId: string, results: any) {
  emitToAllInGame(io, gameId, 'game-complete', {
    gameId,
    results,
    timestamp: new Date().toISOString(),
  })
}

// Chat and notifications
export function sendNotificationToUser(io: SocketIOServer, userId: string, notification: any) {
  emitToUser(io, userId, 'notification', {
    id: Math.random().toString(36).substr(2, 9),
    ...notification,
    timestamp: new Date().toISOString(),
  })
}