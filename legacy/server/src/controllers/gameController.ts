import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import crypto from 'crypto'
import { ValidationError, AuthenticationError } from '../middleware/errorHandler'
import db from '../utils/database'

// Validation schemas
const createGameSchema = z.object({
  boardId: z.string().uuid(),
  maxPlayers: z.number().min(1).max(4).default(4),
  name: z.string().min(1).max(100).optional(),
})

const joinGameSchema = z.object({
  robotName: z.string().min(1).max(50).optional(),
})

const submitTurnSchema = z.object({
  selectedCards: z.array(z.object({
    type: z.enum(['move1', 'move2', 'move3', 'rotateLeft', 'rotateRight', 'uTurn']),
    priority: z.number(),
  })).min(1).max(5),
})

const startGameSchema = z.object({
  startPositions: z.array(z.object({
    playerId: z.string().uuid(),
    position: z.object({
      x: z.number(),
      y: z.number(),
    }),
  })),
})

export class GameController {
  static async createGame(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id
      if (!userId) {
        throw new AuthenticationError('User not authenticated')
      }

      const validatedData = createGameSchema.parse(req.body)
      
      // Check if board exists and user has access
      const board = await db('boards').where({ id: validatedData.boardId }).first()
      if (!board) {
        throw new ValidationError('Board not found')
      }

      if (!board.is_public && board.created_by !== userId) {
        throw new AuthenticationError('Access denied to this board')
      }

      // Create game
      const gameId = crypto.randomUUID()
      const game = await db('games').insert({
        id: gameId,
        board_id: validatedData.boardId,
        created_by: userId,
        max_players: validatedData.maxPlayers,
        current_turn: 0,
        phase: 'waiting',
        created_at: new Date(),
        last_activity: new Date(),
      }).returning('*')

      // Add creator as first player
      await db('game_players').insert({
        id: crypto.randomUUID(),
        game_id: gameId,
        user_id: userId,
        robot_position: JSON.stringify({ x: 0, y: 0 }), // Will be set when game starts
        robot_facing: 'north',
        checkpoints_reached: JSON.stringify([]),
        is_ready: false,
        last_seen: new Date(),
        hand: JSON.stringify([]),
        selected_cards: JSON.stringify([]),
      })

      // Fetch complete game data
      const completeGame = await GameController.getCompleteGameData(gameId)

      res.status(201).json({
        success: true,
        data: { game: completeGame },
      })
    } catch (error) {
      next(error)
    }
  }

  static async joinGame(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: gameId } = req.params
      const userId = req.user?.id
      
      if (!userId) {
        throw new AuthenticationError('User not authenticated')
      }

      const validatedData = joinGameSchema.parse(req.body)

      // Check if game exists
      const game = await db('games').where({ id: gameId }).first()
      if (!game) {
        throw new ValidationError('Game not found')
      }

      if (game.phase !== 'waiting') {
        throw new ValidationError('Game has already started')
      }

      // Check if user is already in the game
      const existingPlayer = await db('game_players')
        .where({ game_id: gameId, user_id: userId })
        .first()
      
      if (existingPlayer) {
        throw new ValidationError('You are already in this game')
      }

      // Check if game is full
      const playerCount = await db('game_players')
        .where({ game_id: gameId })
        .count('* as count')
        .first()

      if (Number(playerCount?.count) >= game.max_players) {
        throw new ValidationError('Game is full')
      }

      // Add player to game
      await db('game_players').insert({
        id: crypto.randomUUID(),
        game_id: gameId,
        user_id: userId,
        robot_position: JSON.stringify({ x: 0, y: 0 }), // Will be set when game starts
        robot_facing: 'north',
        checkpoints_reached: JSON.stringify([]),
        is_ready: false,
        last_seen: new Date(),
        hand: JSON.stringify([]),
        selected_cards: JSON.stringify([]),
      })

      // Update game activity
      await db('games')
        .where({ id: gameId })
        .update({ last_activity: new Date() })

      // Fetch complete game data
      const completeGame = await GameController.getCompleteGameData(gameId)

      res.json({
        success: true,
        data: { game: completeGame },
      })
    } catch (error) {
      next(error)
    }
  }

  static async getGame(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: gameId } = req.params
      const userId = req.user?.id
      
      if (!userId) {
        throw new AuthenticationError('User not authenticated')
      }

      // Check if user is in the game
      const player = await db('game_players')
        .where({ game_id: gameId, user_id: userId })
        .first()
      
      if (!player) {
        throw new AuthenticationError('You are not a player in this game')
      }

      // Fetch complete game data
      const game = await GameController.getCompleteGameData(gameId)
      if (!game) {
        throw new ValidationError('Game not found')
      }

      res.json({
        success: true,
        data: { game },
      })
    } catch (error) {
      next(error)
    }
  }

  static async getAvailableGames(req: Request, res: Response, next: NextFunction) {
    try {
      const { page = 1, limit = 20 } = req.query
      const offset = (Number(page) - 1) * Number(limit)

      // Get games in waiting phase that aren't full
      const games = await db('games')
        .select([
          'games.*',
          'boards.name as board_name',
          'users.username as creator_name',
          db.raw('COUNT(game_players.id) as current_players')
        ])
        .leftJoin('boards', 'games.board_id', 'boards.id')
        .leftJoin('users', 'games.created_by', 'users.id')
        .leftJoin('game_players', 'games.id', 'game_players.game_id')
        .where('games.phase', 'waiting')
        .groupBy('games.id', 'boards.name', 'users.username')
        .having(db.raw('COUNT(game_players.id) < games.max_players'))
        .orderBy('games.created_at', 'desc')
        .limit(Number(limit))
        .offset(offset)

      const totalCount = await db('games')
        .leftJoin('game_players', 'games.id', 'game_players.game_id')
        .where('games.phase', 'waiting')
        .groupBy('games.id')
        .having(db.raw('COUNT(game_players.id) < games.max_players'))
        .count('* as count')
        .first()

      res.json({
        success: true,
        data: {
          items: games,
          page: Number(page),
          limit: Number(limit),
          totalItems: Number(totalCount?.count || 0),
          totalPages: Math.ceil(Number(totalCount?.count || 0) / Number(limit)),
        },
      })
    } catch (error) {
      next(error)
    }
  }

  static async getUserGames(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id
      if (!userId) {
        throw new AuthenticationError('User not authenticated')
      }

      const { page = 1, limit = 20 } = req.query
      const offset = (Number(page) - 1) * Number(limit)

      const games = await db('games')
        .select([
          'games.*',
          'boards.name as board_name',
          'users.username as creator_name',
          db.raw('COUNT(game_players.id) as current_players')
        ])
        .leftJoin('boards', 'games.board_id', 'boards.id')
        .leftJoin('users', 'games.created_by', 'users.id')
        .leftJoin('game_players', 'games.id', 'game_players.game_id')
        .whereIn('games.id', function() {
          this.select('game_id').from('game_players').where('user_id', userId)
        })
        .groupBy('games.id', 'boards.name', 'users.username')
        .orderBy('games.last_activity', 'desc')
        .limit(Number(limit))
        .offset(offset)

      const totalCount = await db('games')
        .whereIn('id', function() {
          this.select('game_id').from('game_players').where('user_id', userId)
        })
        .count('* as count')
        .first()

      res.json({
        success: true,
        data: {
          items: games,
          page: Number(page),
          limit: Number(limit),
          totalItems: Number(totalCount?.count || 0),
          totalPages: Math.ceil(Number(totalCount?.count || 0) / Number(limit)),
        },
      })
    } catch (error) {
      next(error)
    }
  }

  static async startGame(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: gameId } = req.params
      const userId = req.user?.id
      
      if (!userId) {
        throw new AuthenticationError('User not authenticated')
      }

      const validatedData = startGameSchema.parse(req.body)

      // Check if user is the game creator
      const game = await db('games').where({ id: gameId }).first()
      if (!game) {
        throw new ValidationError('Game not found')
      }

      if (game.created_by !== userId) {
        throw new AuthenticationError('Only the game creator can start the game')
      }

      if (game.phase !== 'waiting') {
        throw new ValidationError('Game has already started')
      }

      // Set starting positions for all players
      for (const startPos of validatedData.startPositions) {
        await db('game_players')
          .where({ game_id: gameId, user_id: startPos.playerId })
          .update({
            robot_position: JSON.stringify(startPos.position),
            is_ready: false, // Reset ready status for first turn
          })
      }

      // Update game phase and deal cards
      await db('games')
        .where({ id: gameId })
        .update({ 
          phase: 'programming',
          current_turn: 1,
          last_activity: new Date(),
        })

      // Deal cards to all players
      await GameController.dealCardsToPlayers(gameId)

      // Fetch updated game data
      const completeGame = await GameController.getCompleteGameData(gameId)

      res.json({
        success: true,
        data: { game: completeGame },
      })
    } catch (error) {
      next(error)
    }
  }

  static async submitTurn(req: Request, res: Response, next: NextFunction) {
    try {
      const { id: gameId } = req.params
      const userId = req.user?.id
      
      if (!userId) {
        throw new AuthenticationError('User not authenticated')
      }

      const validatedData = submitTurnSchema.parse(req.body)

      // Check if user is in the game
      const player = await db('game_players')
        .where({ game_id: gameId, user_id: userId })
        .first()
      
      if (!player) {
        throw new AuthenticationError('You are not a player in this game')
      }

      const game = await db('games').where({ id: gameId }).first()
      if (!game) {
        throw new ValidationError('Game not found')
      }

      if (game.phase !== 'programming') {
        throw new ValidationError('Game is not in programming phase')
      }

      // Update player's selected cards and ready status
      await db('game_players')
        .where({ game_id: gameId, user_id: userId })
        .update({
          selected_cards: JSON.stringify(validatedData.selectedCards),
          is_ready: true,
          last_seen: new Date(),
        })

      // Check if all players are ready
      const allPlayersReady = await GameController.areAllPlayersReady(gameId)
      
      if (allPlayersReady) {
        // Execute turn for all players
        await GameController.executeTurn(gameId)
      }

      // Fetch updated game data
      const completeGame = await GameController.getCompleteGameData(gameId)

      res.json({
        success: true,
        data: { game: completeGame },
      })
    } catch (error) {
      next(error)
    }
  }

  // Helper methods for game logic
  static async areAllPlayersReady(gameId: string): Promise<boolean> {
    const notReadyCount = await db('game_players')
      .where({ game_id: gameId, is_ready: false })
      .count('* as count')
      .first()
    
    return Number(notReadyCount?.count) === 0
  }

  static async dealCardsToPlayers(gameId: string): Promise<void> {
    const players = await db('game_players').where({ game_id: gameId })
    
    for (const player of players) {
      const hand = GameController.generateCardHand()
      await db('game_players')
        .where({ id: player.id })
        .update({ hand: JSON.stringify(hand) })
    }
  }

  static generateCardHand() {
    const cardTypes = ['move1', 'move2', 'move3', 'rotateLeft', 'rotateRight', 'uTurn']
    const hand = []
    
    // Generate 9 random cards with priorities
    for (let i = 0; i < 9; i++) {
      hand.push({
        id: crypto.randomUUID(),
        type: cardTypes[Math.floor(Math.random() * cardTypes.length)],
        priority: Math.floor(Math.random() * 100) + 1, // 1-100
      })
    }
    
    return hand
  }

  static async executeTurn(gameId: string): Promise<void> {
    // Change game phase to executing
    await db('games')
      .where({ id: gameId })
      .update({ 
        phase: 'executing',
        last_activity: new Date(),
      })

    try {
      // Get all players and their selected cards
      const players = await db('game_players').where({ game_id: gameId })
      const game = await db('games').where({ id: gameId }).first()
      const board = await db('boards').where({ id: game.board_id }).first()

      // Execute each register (card slot) in priority order
      for (let register = 0; register < 5; register++) {
        const moves = []
        
        // Collect all moves for this register
        for (const player of players) {
          const selectedCards = JSON.parse(player.selected_cards)
          if (selectedCards[register]) {
            moves.push({
              playerId: player.user_id,
              card: selectedCards[register],
              currentPosition: JSON.parse(player.robot_position),
              currentFacing: player.robot_facing,
            })
          }
        }

        // Sort moves by priority (higher priority goes first)
        moves.sort((a, b) => b.card.priority - a.card.priority)

        // Execute moves in priority order
        for (const move of moves) {
          await GameController.executePlayerMove(gameId, move, board)
        }

        // Apply board effects (conveyors, etc.)
        await GameController.applyBoardEffects(gameId, board)
      }

      // Check for win condition
      const winner = await GameController.checkWinCondition(gameId, board)
      
      if (winner) {
        // Game complete
        await db('games')
          .where({ id: gameId })
          .update({ 
            phase: 'complete',
            winner_id: winner,
            completed_at: new Date(),
            last_activity: new Date(),
          })
      } else {
        // Start next turn
        await db('games')
          .where({ id: gameId })
          .update({ 
            phase: 'programming',
            current_turn: game.current_turn + 1,
            last_activity: new Date(),
          })

        // Reset player ready status and deal new cards
        await db('game_players')
          .where({ game_id: gameId })
          .update({ 
            is_ready: false,
            selected_cards: JSON.stringify([]),
          })

        await GameController.dealCardsToPlayers(gameId)
      }

      // Record turn in history
      await db('game_turns').insert({
        id: crypto.randomUUID(),
        game_id: gameId,
        turn_number: game.current_turn,
        moves: JSON.stringify(moves),
        created_at: new Date(),
      })

    } catch (error) {
      // If execution fails, revert to programming phase
      await db('games')
        .where({ id: gameId })
        .update({ phase: 'programming' })
      throw error
    }
  }

  static async executePlayerMove(gameId: string, move: any, board: any): Promise<void> {
    const { playerId, card, currentPosition, currentFacing } = move
    let newPosition = { ...currentPosition }
    let newFacing = currentFacing

    // Execute the move based on card type
    switch (card.type) {
      case 'move1':
        newPosition = GameController.moveForward(currentPosition, currentFacing, 1)
        break
      case 'move2':
        newPosition = GameController.moveForward(currentPosition, currentFacing, 2)
        break
      case 'move3':
        newPosition = GameController.moveForward(currentPosition, currentFacing, 3)
        break
      case 'rotateLeft':
        newFacing = GameController.rotateLeft(currentFacing)
        break
      case 'rotateRight':
        newFacing = GameController.rotateRight(currentFacing)
        break
      case 'uTurn':
        newFacing = GameController.uTurn(currentFacing)
        break
    }

    // Validate move (check for walls, board boundaries, etc.)
    const validatedPosition = GameController.validateMove(newPosition, board)

    // Update player position
    await db('game_players')
      .where({ game_id: gameId, user_id: playerId })
      .update({
        robot_position: JSON.stringify(validatedPosition),
        robot_facing: newFacing,
      })

    // Check for checkpoint collection
    await GameController.checkCheckpointCollection(gameId, playerId, validatedPosition, board)
  }

  static moveForward(position: { x: number; y: number }, facing: string, spaces: number) {
    let newPosition = { ...position }
    
    for (let i = 0; i < spaces; i++) {
      switch (facing) {
        case 'north':
          newPosition.y -= 1
          break
        case 'south':
          newPosition.y += 1
          break
        case 'east':
          newPosition.x += 1
          break
        case 'west':
          newPosition.x -= 1
          break
      }
    }
    
    return newPosition
  }

  static rotateLeft(facing: string): string {
    const rotations = { north: 'west', west: 'south', south: 'east', east: 'north' }
    return rotations[facing] || facing
  }

  static rotateRight(facing: string): string {
    const rotations = { north: 'east', east: 'south', south: 'west', west: 'north' }
    return rotations[facing] || facing
  }

  static uTurn(facing: string): string {
    const rotations = { north: 'south', south: 'north', east: 'west', west: 'east' }
    return rotations[facing] || facing
  }

  static validateMove(position: { x: number; y: number }, board: any) {
    const boardData = JSON.parse(board.tiles)
    const boardSize = JSON.parse(board.size)
    
    // Check board boundaries
    if (position.x < 0 || position.x >= boardSize.width || 
        position.y < 0 || position.y >= boardSize.height) {
      // Robot falls off the board - return to starting position or previous valid position
      // For now, just clamp to board boundaries
      return {
        x: Math.max(0, Math.min(boardSize.width - 1, position.x)),
        y: Math.max(0, Math.min(boardSize.height - 1, position.y)),
      }
    }

    // Check for walls
    const tile = boardData[position.y] && boardData[position.y][position.x]
    if (tile && tile.type === 'wall') {
      // Can't move into wall, return previous position
      // This is simplified - in a real implementation, you'd need to track the previous position
      return position
    }

    return position
  }

  static async checkCheckpointCollection(gameId: string, playerId: string, position: { x: number; y: number }, board: any): Promise<void> {
    const player = await db('game_players')
      .where({ game_id: gameId, user_id: playerId })
      .first()
    
    if (!player) return

    const checkpointsReached = JSON.parse(player.checkpoints_reached)
    const boardData = JSON.parse(board.tiles)
    const tile = boardData[position.y] && boardData[position.y][position.x]

    if (tile && tile.type === 'checkpoint' && tile.checkpointNumber) {
      const nextCheckpoint = checkpointsReached.length + 1
      
      // Check if this is the next checkpoint in sequence
      if (tile.checkpointNumber === nextCheckpoint) {
        checkpointsReached.push(tile.checkpointNumber)
        
        await db('game_players')
          .where({ game_id: gameId, user_id: playerId })
          .update({
            checkpoints_reached: JSON.stringify(checkpointsReached),
          })
      }
    }
  }

  static async applyBoardEffects(gameId: string, board: any): Promise<void> {
    // Apply conveyor belt effects
    const players = await db('game_players').where({ game_id: gameId })
    const boardData = JSON.parse(board.tiles)

    for (const player of players) {
      const position = JSON.parse(player.robot_position)
      const tile = boardData[position.y] && boardData[position.y][position.x]
      
      if (tile && (tile.type === 'conveyorNormal' || tile.type === 'conveyorFast')) {
        const spaces = tile.type === 'conveyorFast' ? 2 : 1
        const newPosition = GameController.moveForward(position, tile.direction, spaces)
        const validatedPosition = GameController.validateMove(newPosition, board)
        
        await db('game_players')
          .where({ id: player.id })
          .update({
            robot_position: JSON.stringify(validatedPosition),
          })
      }
    }
  }

  static async checkWinCondition(gameId: string, board: any): Promise<string | null> {
    const boardCheckpoints = JSON.parse(board.checkpoints)
    const totalCheckpoints = boardCheckpoints.length
    
    if (totalCheckpoints === 0) return null

    // Check if any player has reached all checkpoints
    const winningPlayer = await db('game_players')
      .where({ game_id: gameId })
      .whereRaw(`JSON_ARRAY_LENGTH(checkpoints_reached) >= ?`, [totalCheckpoints])
      .first()

    return winningPlayer ? winningPlayer.user_id : null
  }

  // Helper method to get complete game data with players and board
  static async getCompleteGameData(gameId: string) {
    const game = await db('games')
      .select([
        'games.*',
        'boards.name as board_name',
        'boards.tiles as board_tiles',
        'boards.checkpoints as board_checkpoints',
        'boards.start_positions as board_start_positions',
        'users.username as creator_name'
      ])
      .leftJoin('boards', 'games.board_id', 'boards.id')
      .leftJoin('users', 'games.created_by', 'users.id')
      .where('games.id', gameId)
      .first()

    if (!game) return null

    const players = await db('game_players')
      .select([
        'game_players.*',
        'users.username',
        'users.display_name'
      ])
      .leftJoin('users', 'game_players.user_id', 'users.id')
      .where('game_players.game_id', gameId)
      .orderBy('game_players.created_at')

    return {
      ...game,
      players: players.map(player => ({
        ...player,
        robot_position: JSON.parse(player.robot_position),
        checkpoints_reached: JSON.parse(player.checkpoints_reached),
        hand: JSON.parse(player.hand),
        selected_cards: JSON.parse(player.selected_cards),
      })),
      board: {
        id: game.board_id,
        name: game.board_name,
        tiles: JSON.parse(game.board_tiles),
        checkpoints: JSON.parse(game.board_checkpoints),
        startPositions: JSON.parse(game.board_start_positions),
      },
    }
  }
}