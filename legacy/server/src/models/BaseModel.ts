import { Knex } from 'knex';
import { db } from '@/utils/database';
import { logger } from '@/utils/logger';
import { handleDatabaseError } from '@/middleware/errorHandler';

export interface BaseModelData {
  id: string;
  created_at: Date;
  updated_at: Date;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export abstract class BaseModel<T extends BaseModelData> {
  protected abstract tableName: string;
  protected db: Knex;

  constructor() {
    this.db = db;
  }

  async findById(id: string): Promise<T | null> {
    try {
      const result = await this.db(this.tableName)
        .where({ id })
        .first();
      
      return result || null;
    } catch (error) {
      logger.error(`Error finding ${this.tableName} by ID:`, error);
      throw handleDatabaseError(error);
    }
  }

  async findAll(options: PaginationOptions = {}): Promise<PaginatedResult<T>> {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = options;

      const offset = (page - 1) * limit;

      // Get total count
      const [{ count }] = await this.db(this.tableName)
        .count('* as count');
      
      const total = parseInt(count as string, 10);

      // Get paginated results
      const items = await this.db(this.tableName)
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
      logger.error(`Error finding all ${this.tableName}:`, error);
      throw handleDatabaseError(error);
    }
  }

  async create(data: Omit<T, 'id' | 'created_at' | 'updated_at'>): Promise<T> {
    try {
      const [result] = await this.db(this.tableName)
        .insert(data)
        .returning('*');
      
      logger.info(`Created ${this.tableName}:`, { id: result.id });
      return result;
    } catch (error) {
      logger.error(`Error creating ${this.tableName}:`, error);
      throw handleDatabaseError(error);
    }
  }

  async update(id: string, data: Partial<Omit<T, 'id' | 'created_at'>>): Promise<T | null> {
    try {
      const [result] = await this.db(this.tableName)
        .where({ id })
        .update({ ...data, updated_at: new Date() })
        .returning('*');
      
      if (result) {
        logger.info(`Updated ${this.tableName}:`, { id });
      }
      
      return result || null;
    } catch (error) {
      logger.error(`Error updating ${this.tableName}:`, error);
      throw handleDatabaseError(error);
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      const deletedRows = await this.db(this.tableName)
        .where({ id })
        .del();
      
      const wasDeleted = deletedRows > 0;
      
      if (wasDeleted) {
        logger.info(`Deleted ${this.tableName}:`, { id });
      }
      
      return wasDeleted;
    } catch (error) {
      logger.error(`Error deleting ${this.tableName}:`, error);
      throw handleDatabaseError(error);
    }
  }

  async exists(id: string): Promise<boolean> {
    try {
      const result = await this.db(this.tableName)
        .where({ id })
        .first('id');
      
      return !!result;
    } catch (error) {
      logger.error(`Error checking existence of ${this.tableName}:`, error);
      throw handleDatabaseError(error);
    }
  }

  async count(conditions: Partial<T> = {}): Promise<number> {
    try {
      const [{ count }] = await this.db(this.tableName)
        .where(conditions)
        .count('* as count');
      
      return parseInt(count as string, 10);
    } catch (error) {
      logger.error(`Error counting ${this.tableName}:`, error);
      throw handleDatabaseError(error);
    }
  }

  protected async transaction<R>(
    callback: (trx: Knex.Transaction) => Promise<R>
  ): Promise<R> {
    return this.db.transaction(callback);
  }
}