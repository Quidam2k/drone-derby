import { BaseModel, BaseModelData, PaginationOptions, PaginatedResult } from './BaseModel';
import { logger } from '../utils/logger';
import { ValidationError, NotFoundError } from '../middleware/errorHandler';
import { Tile, Position } from '../../../shared/types/game';

export interface BoardData extends BaseModelData {
  name: string;
  tiles: Tile[][];
  checkpoints: Array<{ id: number; position: Position }>;
  start_positions: Position[];
  created_by: string;
  is_public: boolean;
  rating: number;
  usage_count: number;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateBoardData {
  name: string;
  tiles: Tile[][];
  checkpoints: Array<{ id: number; position: Position }>;
  start_positions: Position[];
  is_public?: boolean;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface BoardSearchOptions extends PaginationOptions {
  query?: string;
  createdBy?: string;
  isPublic?: boolean;
  minRating?: number;
}

export interface BoardListItem {
  id: string;
  name: string;
  created_by: string;
  created_by_name: string;
  is_public: boolean;
  rating: number;
  usage_count: number;
  description?: string;
  created_at: Date;
  updated_at: Date;
}

export class BoardModel extends BaseModel<BoardData> {
  protected tableName = 'boards';

  async create(data: CreateBoardData, userId: string): Promise<BoardData> {
    // Validate board data
    this.validateBoardData(data);

    const boardData = {
      ...data,
      created_by: userId,
      rating: 0,
      usage_count: 0,
      is_public: data.is_public ?? false,
    };

    const result = await super.create(boardData);
    logger.info('Board created:', { boardId: result.id, name: result.name, userId });
    return result;
  }

  async findByUser(
    userId: string, 
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<BoardData>> {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'updated_at',
        sortOrder = 'desc'
      } = options;

      const offset = (page - 1) * limit;

      // Get total count
      const [{ count }] = await this.db(this.tableName)
        .where({ created_by: userId })
        .count('* as count');
      
      const total = parseInt(count as string, 10);

      // Get paginated results
      const items = await this.db(this.tableName)
        .where({ created_by: userId })
        .orderBy(sortBy, sortOrder)
        .limit(limit)
        .offset(offset);

      return {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      logger.error('Error finding boards by user:', error);
      throw error;
    }
  }

  async findPublic(options: PaginationOptions = {}): Promise<PaginatedResult<BoardData>> {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'rating',
        sortOrder = 'desc'
      } = options;

      const offset = (page - 1) * limit;

      // Get total count
      const [{ count }] = await this.db(this.tableName)
        .where({ is_public: true })
        .count('* as count');
      
      const total = parseInt(count as string, 10);

      // Get paginated results
      const items = await this.db(this.tableName)
        .where({ is_public: true })
        .orderBy(sortBy, sortOrder)
        .limit(limit)
        .offset(offset);

      return {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      logger.error('Error finding public boards:', error);
      throw error;
    }
  }

  async search(options: BoardSearchOptions = {}): Promise<PaginatedResult<BoardListItem>> {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'rating',
        sortOrder = 'desc',
        query,
        createdBy,
        isPublic,
        minRating
      } = options;

      const offset = (page - 1) * limit;

      // Build search query
      let searchQuery = this.db(this.tableName)
        .leftJoin('users', 'boards.created_by', 'users.id')
        .select(
          'boards.id',
          'boards.name',
          'boards.created_by',
          'users.display_name as created_by_name',
          'boards.is_public',
          'boards.rating',
          'boards.usage_count',
          'boards.description',
          'boards.created_at',
          'boards.updated_at'
        );

      // Apply filters
      if (query) {
        searchQuery = searchQuery.where(function() {
          this.where('boards.name', 'ilike', `%${query}%`)
            .orWhere('boards.description', 'ilike', `%${query}%`);
        });
      }

      if (createdBy) {
        searchQuery = searchQuery.where('boards.created_by', createdBy);
      }

      if (isPublic !== undefined) {
        searchQuery = searchQuery.where('boards.is_public', isPublic);
      }

      if (minRating !== undefined) {
        searchQuery = searchQuery.where('boards.rating', '>=', minRating);
      }

      // Get total count
      const [{ count }] = await searchQuery.clone().count('boards.id as count');
      const total = parseInt(count as string, 10);

      // Get paginated results
      const items = await searchQuery
        .orderBy(`boards.${sortBy}`, sortOrder)
        .limit(limit)
        .offset(offset);

      return {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      logger.error('Error searching boards:', error);
      throw error;
    }
  }

  async incrementUsage(boardId: string): Promise<void> {
    try {
      await this.db(this.tableName)
        .where({ id: boardId })
        .increment('usage_count', 1)
        .update({ updated_at: new Date() });
      
      logger.info('Board usage incremented:', { boardId });
    } catch (error) {
      logger.error('Error incrementing board usage:', error);
      throw error;
    }
  }

  async updateRating(boardId: string, newRating: number): Promise<void> {
    try {
      if (newRating < 0 || newRating > 5) {
        throw new ValidationError('Rating must be between 0 and 5');
      }

      await this.db(this.tableName)
        .where({ id: boardId })
        .update({ 
          rating: newRating,
          updated_at: new Date()
        });
      
      logger.info('Board rating updated:', { boardId, newRating });
    } catch (error) {
      logger.error('Error updating board rating:', error);
      throw error;
    }
  }

  async canUserEdit(boardId: string, userId: string): Promise<boolean> {
    try {
      const board = await this.findById(boardId);
      if (!board) {
        throw new NotFoundError('Board');
      }

      return board.created_by === userId;
    } catch (error) {
      logger.error('Error checking board edit permission:', error);
      throw error;
    }
  }

  async duplicate(boardId: string, userId: string, newName?: string): Promise<BoardData> {
    try {
      const originalBoard = await this.findById(boardId);
      if (!originalBoard) {
        throw new NotFoundError('Board');
      }

      const duplicateData: CreateBoardData = {
        name: newName || `${originalBoard.name} (Copy)`,
        tiles: originalBoard.tiles,
        checkpoints: originalBoard.checkpoints,
        start_positions: originalBoard.start_positions,
        description: originalBoard.description,
        is_public: false, // Duplicates are private by default
        metadata: originalBoard.metadata,
      };

      return await this.create(duplicateData, userId);
    } catch (error) {
      logger.error('Error duplicating board:', error);
      throw error;
    }
  }

  private validateBoardData(data: CreateBoardData): void {
    // Validate name
    if (!data.name || data.name.length < 1 || data.name.length > 100) {
      throw new ValidationError('Board name must be between 1 and 100 characters');
    }

    // Validate board dimensions
    if (!data.tiles || !Array.isArray(data.tiles)) {
      throw new ValidationError('Board tiles must be a 2D array');
    }

    if (data.tiles.length !== 10) {
      throw new ValidationError('Board must be exactly 10 rows');
    }

    for (const row of data.tiles) {
      if (!Array.isArray(row) || row.length !== 10) {
        throw new ValidationError('Each board row must be exactly 10 tiles');
      }
    }

    // Validate checkpoints
    if (!data.checkpoints || !Array.isArray(data.checkpoints)) {
      throw new ValidationError('Checkpoints must be an array');
    }

    if (data.checkpoints.length === 0) {
      throw new ValidationError('Board must have at least one checkpoint');
    }

    // Validate checkpoint numbering
    const checkpointNumbers = data.checkpoints.map(cp => cp.id).sort((a, b) => a - b);
    for (let i = 0; i < checkpointNumbers.length; i++) {
      if (checkpointNumbers[i] !== i + 1) {
        throw new ValidationError('Checkpoints must be numbered sequentially starting from 1');
      }
    }

    // Validate start positions
    if (!data.start_positions || !Array.isArray(data.start_positions)) {
      throw new ValidationError('Start positions must be an array');
    }

    if (data.start_positions.length < 2 || data.start_positions.length > 4) {
      throw new ValidationError('Board must have 2-4 start positions');
    }

    // Validate positions are within bounds
    const allPositions = [
      ...data.checkpoints.map(cp => cp.position),
      ...data.start_positions
    ];

    for (const pos of allPositions) {
      if (pos.x < 0 || pos.x >= 10 || pos.y < 0 || pos.y >= 10) {
        throw new ValidationError('All positions must be within the 10x10 board');
      }
    }

    // Validate that checkpoint and start positions correspond to actual tiles
    for (const checkpoint of data.checkpoints) {
      const tile = data.tiles[checkpoint.position.y][checkpoint.position.x];
      if (tile.type !== 'checkpoint' || tile.checkpointNumber !== checkpoint.id) {
        throw new ValidationError(`Checkpoint ${checkpoint.id} position does not match tile data`);
      }
    }

    for (const startPos of data.start_positions) {
      const tile = data.tiles[startPos.y][startPos.x];
      if (tile.type !== 'start') {
        throw new ValidationError('Start position does not match tile data');
      }
    }
  }
}