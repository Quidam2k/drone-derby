import { Request, Response, NextFunction } from 'express'
import { BoardModel } from '../models/Board'
import { ValidationError, AuthenticationError } from '../middleware/errorHandler'
import { z } from 'zod'

// Create a Board model instance
const Board = new BoardModel()

// Validation schemas
const createBoardSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  tiles: z.array(z.array(z.object({
    type: z.enum(['floor', 'wall', 'conveyorNormal', 'conveyorFast', 'checkpoint', 'start']),
    direction: z.enum(['north', 'south', 'east', 'west']).optional(),
    checkpointNumber: z.number().optional(),
  }))),
  checkpoints: z.array(z.object({
    id: z.number(),
    position: z.object({
      x: z.number(),
      y: z.number(),
    }),
  })),
  startPositions: z.array(z.object({
    x: z.number(),
    y: z.number(),
  })),
  isPublic: z.boolean().default(false),
})

const updateBoardSchema = createBoardSchema.partial().omit({ isPublic: true }).extend({
  isPublic: z.boolean().optional(),
})

const searchBoardsSchema = z.object({
  query: z.string().optional(),
  isPublic: z.boolean().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt', 'rating']).default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

const rateBoardSchema = z.object({
  rating: z.number().min(1).max(5),
})

export class BoardController {
  static async createBoard(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id
      if (!userId) {
        throw new AuthenticationError('User not authenticated')
      }

      const validatedData = createBoardSchema.parse(req.body)
      
      // Create board (validation is handled in the model)
      const board = await Board.create({
        name: validatedData.name,
        description: validatedData.description,
        tiles: validatedData.tiles,
        checkpoints: validatedData.checkpoints,
        start_positions: validatedData.startPositions,
        is_public: validatedData.isPublic,
      }, userId)

      res.status(201).json({
        success: true,
        data: { board },
      })
    } catch (error) {
      next(error)
    }
  }

  static async getBoard(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params
      const userId = req.user?.id

      const board = await Board.findById(id)
      if (!board) {
        throw new ValidationError('Board not found')
      }

      // Check if user has permission to view this board
      if (!board.is_public && board.created_by !== userId) {
        throw new AuthenticationError('Access denied')
      }

      res.json({
        success: true,
        data: { board },
      })
    } catch (error) {
      next(error)
    }
  }

  static async updateBoard(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params
      const userId = req.user?.id
      
      if (!userId) {
        throw new AuthenticationError('User not authenticated')
      }

      const validatedData = updateBoardSchema.parse(req.body)

      // Check if board exists and user owns it
      const existingBoard = await Board.findById(id)
      if (!existingBoard) {
        throw new ValidationError('Board not found')
      }

      if (existingBoard.created_by !== userId) {
        throw new AuthenticationError('Access denied')
      }

      // Update board (validation is handled in the model)
      const updateData = {
        ...(validatedData.name && { name: validatedData.name }),
        ...(validatedData.description !== undefined && { description: validatedData.description }),
        ...(validatedData.tiles && { tiles: validatedData.tiles }),
        ...(validatedData.checkpoints && { checkpoints: validatedData.checkpoints }),
        ...(validatedData.startPositions && { start_positions: validatedData.startPositions }),
        ...(validatedData.isPublic !== undefined && { is_public: validatedData.isPublic }),
      }
      
      const updatedBoard = await Board.update(id, updateData)

      res.json({
        success: true,
        data: { board: updatedBoard },
      })
    } catch (error) {
      next(error)
    }
  }

  static async deleteBoard(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params
      const userId = req.user?.id
      
      if (!userId) {
        throw new AuthenticationError('User not authenticated')
      }

      // Check if board exists and user owns it
      const board = await Board.findById(id)
      if (!board) {
        throw new ValidationError('Board not found')
      }

      if (board.created_by !== userId) {
        throw new AuthenticationError('Access denied')
      }

      // Delete board
      await Board.delete(id)

      res.json({
        success: true,
        message: 'Board deleted successfully',
      })
    } catch (error) {
      next(error)
    }
  }

  static async getPublicBoards(req: Request, res: Response, next: NextFunction) {
    try {
      const { page = 1, limit = 20 } = req.query
      
      const result = await Board.findPublic({
        page: Number(page),
        limit: Number(limit),
      })

      res.json({
        success: true,
        data: result,
      })
    } catch (error) {
      next(error)
    }
  }

  static async getUserBoards(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id
      if (!userId) {
        throw new AuthenticationError('User not authenticated')
      }

      const { page = 1, limit = 20 } = req.query
      
      const result = await Board.findByUser(userId, {
        page: Number(page),
        limit: Number(limit),
      })

      res.json({
        success: true,
        data: result,
      })
    } catch (error) {
      next(error)
    }
  }

  static async searchBoards(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id
      const validatedQuery = searchBoardsSchema.parse(req.query)
      
      const result = await Board.search({
        ...validatedQuery,
        createdBy: userId, // Include user ID for permission filtering
      })

      res.json({
        success: true,
        data: result,
      })
    } catch (error) {
      next(error)
    }
  }

  static async duplicateBoard(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params
      const userId = req.user?.id
      const { newName } = req.body
      
      if (!userId) {
        throw new AuthenticationError('User not authenticated')
      }

      // Get the original board
      const originalBoard = await Board.findById(id)
      if (!originalBoard) {
        throw new ValidationError('Board not found')
      }

      // Check if user has permission to view this board
      if (!originalBoard.is_public && originalBoard.created_by !== userId) {
        throw new AuthenticationError('Access denied')
      }

      // Create duplicate
      const duplicatedBoard = await Board.duplicate(id, userId, newName)

      res.status(201).json({
        success: true,
        data: { board: duplicatedBoard },
      })
    } catch (error) {
      next(error)
    }
  }

  static async validateBoard(req: Request, res: Response, next: NextFunction) {
    try {
      const boardData = req.body
      
      // Try to validate by attempting to create board data
      try {
        // This will throw an error if invalid
        const testBoard = new BoardModel()
        // We can't easily validate without creating, so we'll do basic validation
        const validation = {
          valid: true,
          errors: [] as string[],
          warnings: [] as string[],
        }
        
        // Basic validation checks
        if (!boardData.name || boardData.name.length < 1) {
          validation.valid = false
          validation.errors.push('Board name is required')
        }
        
        if (!boardData.tiles || !Array.isArray(boardData.tiles)) {
          validation.valid = false
          validation.errors.push('Tiles array is required')
        }
        
        if (!boardData.checkpoints || !Array.isArray(boardData.checkpoints)) {
          validation.valid = false
          validation.errors.push('Checkpoints array is required')
        }
        
        if (!boardData.startPositions || !Array.isArray(boardData.startPositions)) {
          validation.valid = false
          validation.errors.push('Start positions array is required')
        }
        
        res.json({
          success: true,
          data: validation,
        })
      } catch (error) {
        res.json({
          success: true,
          data: {
            valid: false,
            errors: [error instanceof Error ? error.message : 'Validation failed'],
            warnings: [],
          },
        })
      }
    } catch (error) {
      next(error)
    }
  }

  static async rateBoard(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params
      const userId = req.user?.id
      
      if (!userId) {
        throw new AuthenticationError('User not authenticated')
      }

      const { rating } = rateBoardSchema.parse(req.body)

      // Check if board exists and is public
      const board = await Board.findById(id)
      if (!board) {
        throw new ValidationError('Board not found')
      }

      if (!board.is_public) {
        throw new ValidationError('Can only rate public boards')
      }

      if (board.created_by === userId) {
        throw new ValidationError('Cannot rate your own board')
      }

      // Rate the board - simple implementation for now
      // In production, you'd want a proper rating system with user votes
      await Board.updateRating(id, rating)
      const updatedBoard = await Board.findById(id)

      res.json({
        success: true,
        data: { board: updatedBoard },
      })
    } catch (error) {
      next(error)
    }
  }
}