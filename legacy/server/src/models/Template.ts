import { BaseModel, BaseModelData, PaginationOptions, PaginatedResult } from './BaseModel';
import { logger } from '@/utils/logger';
import { ValidationError, NotFoundError } from '@/middleware/errorHandler';
import { Tile } from '../../../shared/types/game';

export interface TemplateData extends BaseModelData {
  name: string;
  description?: string;
  width: number;
  height: number;
  tiles: Tile[][];
  preview_image?: string;
  created_by: string;
  is_public: boolean;
  tags: string[];
  rating: number;
  downloads: number;
  category?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateTemplateData {
  name: string;
  description?: string;
  width: number;
  height: number;
  tiles: Tile[][];
  preview_image?: string;
  is_public?: boolean;
  tags?: string[];
  category?: string;
  metadata?: Record<string, unknown>;
}

export interface TemplateSearchOptions extends PaginationOptions {
  query?: string;
  tags?: string[];
  createdBy?: string;
  isPublic?: boolean;
  category?: string;
  minRating?: number;
}

export interface TemplateListItem {
  id: string;
  name: string;
  description?: string;
  width: number;
  height: number;
  preview_image?: string;
  created_by: string;
  created_by_name: string;
  is_public: boolean;
  tags: string[];
  rating: number;
  downloads: number;
  category?: string;
  created_at: Date;
  updated_at: Date;
}

export class TemplateModel extends BaseModel<TemplateData> {
  protected tableName = 'templates';

  async create(data: CreateTemplateData, userId: string): Promise<TemplateData> {
    // Validate template data
    this.validateTemplateData(data);

    const templateData = {
      ...data,
      created_by: userId,
      rating: 0,
      downloads: 0,
      is_public: data.is_public ?? false,
      tags: data.tags ?? [],
    };

    const result = await super.create(templateData);
    logger.info('Template created:', { templateId: result.id, name: result.name, userId });
    return result;
  }

  async findByUser(
    userId: string, 
    options: PaginationOptions = {}
  ): Promise<PaginatedResult<TemplateData>> {
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
      logger.error('Error finding templates by user:', error);
      throw error;
    }
  }

  async findPublic(options: PaginationOptions = {}): Promise<PaginatedResult<TemplateData>> {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'downloads',
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
      logger.error('Error finding public templates:', error);
      throw error;
    }
  }

  async search(options: TemplateSearchOptions = {}): Promise<PaginatedResult<TemplateListItem>> {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'downloads',
        sortOrder = 'desc',
        query,
        tags,
        createdBy,
        isPublic,
        category,
        minRating
      } = options;

      const offset = (page - 1) * limit;

      // Build search query
      let searchQuery = this.db(this.tableName)
        .leftJoin('users', 'templates.created_by', 'users.id')
        .select(
          'templates.id',
          'templates.name',
          'templates.description',
          'templates.width',
          'templates.height',
          'templates.preview_image',
          'templates.created_by',
          'users.display_name as created_by_name',
          'templates.is_public',
          'templates.tags',
          'templates.rating',
          'templates.downloads',
          'templates.category',
          'templates.created_at',
          'templates.updated_at'
        );

      // Apply filters
      if (query) {
        searchQuery = searchQuery.where(function() {
          this.where('templates.name', 'ilike', `%${query}%`)
            .orWhere('templates.description', 'ilike', `%${query}%`);
        });
      }

      if (tags && tags.length > 0) {
        // Search for templates that have any of the specified tags
        searchQuery = searchQuery.whereRaw(
          'EXISTS (SELECT 1 FROM jsonb_array_elements_text(templates.tags) tag WHERE tag = ANY(?))',
          [tags]
        );
      }

      if (createdBy) {
        searchQuery = searchQuery.where('templates.created_by', createdBy);
      }

      if (isPublic !== undefined) {
        searchQuery = searchQuery.where('templates.is_public', isPublic);
      }

      if (category) {
        searchQuery = searchQuery.where('templates.category', category);
      }

      if (minRating !== undefined) {
        searchQuery = searchQuery.where('templates.rating', '>=', minRating);
      }

      // Get total count
      const [{ count }] = await searchQuery.clone().count('templates.id as count');
      const total = parseInt(count as string, 10);

      // Get paginated results
      const items = await searchQuery
        .orderBy(`templates.${sortBy}`, sortOrder)
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
      logger.error('Error searching templates:', error);
      throw error;
    }
  }

  async incrementDownloads(templateId: string): Promise<void> {
    try {
      await this.db(this.tableName)
        .where({ id: templateId })
        .increment('downloads', 1)
        .update({ updated_at: new Date() });
      
      logger.info('Template downloads incremented:', { templateId });
    } catch (error) {
      logger.error('Error incrementing template downloads:', error);
      throw error;
    }
  }

  async updateRating(templateId: string, newRating: number): Promise<void> {
    try {
      if (newRating < 0 || newRating > 5) {
        throw new ValidationError('Rating must be between 0 and 5');
      }

      await this.db(this.tableName)
        .where({ id: templateId })
        .update({ 
          rating: newRating,
          updated_at: new Date()
        });
      
      logger.info('Template rating updated:', { templateId, newRating });
    } catch (error) {
      logger.error('Error updating template rating:', error);
      throw error;
    }
  }

  async canUserEdit(templateId: string, userId: string): Promise<boolean> {
    try {
      const template = await this.findById(templateId);
      if (!template) {
        throw new NotFoundError('Template');
      }

      return template.created_by === userId;
    } catch (error) {
      logger.error('Error checking template edit permission:', error);
      throw error;
    }
  }

  async getPopularTemplates(limit: number = 10): Promise<TemplateListItem[]> {
    try {
      const templates = await this.db(this.tableName)
        .leftJoin('users', 'templates.created_by', 'users.id')
        .select(
          'templates.id',
          'templates.name',
          'templates.description',
          'templates.width',
          'templates.height',
          'templates.preview_image',
          'templates.created_by',
          'users.display_name as created_by_name',
          'templates.is_public',
          'templates.tags',
          'templates.rating',
          'templates.downloads',
          'templates.category',
          'templates.created_at',
          'templates.updated_at'
        )
        .where('templates.is_public', true)
        .orderBy('templates.downloads', 'desc')
        .orderBy('templates.rating', 'desc')
        .limit(limit);

      return templates;
    } catch (error) {
      logger.error('Error getting popular templates:', error);
      throw error;
    }
  }

  async getTemplatesByCategory(category: string, limit: number = 20): Promise<TemplateListItem[]> {
    try {
      const templates = await this.db(this.tableName)
        .leftJoin('users', 'templates.created_by', 'users.id')
        .select(
          'templates.id',
          'templates.name',
          'templates.description',
          'templates.width',
          'templates.height',
          'templates.preview_image',
          'templates.created_by',
          'users.display_name as created_by_name',
          'templates.is_public',
          'templates.tags',
          'templates.rating',
          'templates.downloads',
          'templates.category',
          'templates.created_at',
          'templates.updated_at'
        )
        .where('templates.is_public', true)
        .where('templates.category', category)
        .orderBy('templates.rating', 'desc')
        .orderBy('templates.downloads', 'desc')
        .limit(limit);

      return templates;
    } catch (error) {
      logger.error('Error getting templates by category:', error);
      throw error;
    }
  }

  async getAllCategories(): Promise<Array<{ category: string; count: number }>> {
    try {
      const categories = await this.db(this.tableName)
        .select('category')
        .count('* as count')
        .where('is_public', true)
        .whereNotNull('category')
        .groupBy('category')
        .orderBy('count', 'desc');

      return categories.map(row => ({
        category: row.category,
        count: parseInt(row.count as string, 10)
      }));
    } catch (error) {
      logger.error('Error getting template categories:', error);
      throw error;
    }
  }

  private validateTemplateData(data: CreateTemplateData): void {
    // Validate name
    if (!data.name || data.name.length < 1 || data.name.length > 100) {
      throw new ValidationError('Template name must be between 1 and 100 characters');
    }

    // Validate description
    if (data.description && data.description.length > 500) {
      throw new ValidationError('Template description must be 500 characters or less');
    }

    // Validate dimensions
    if (!data.width || !data.height || data.width < 1 || data.height < 1) {
      throw new ValidationError('Template dimensions must be positive integers');
    }

    if (data.width > 10 || data.height > 10) {
      throw new ValidationError('Template dimensions cannot exceed 10x10');
    }

    // Validate tiles
    if (!data.tiles || !Array.isArray(data.tiles)) {
      throw new ValidationError('Template tiles must be a 2D array');
    }

    if (data.tiles.length !== data.height) {
      throw new ValidationError('Template tiles height must match specified height');
    }

    for (const row of data.tiles) {
      if (!Array.isArray(row) || row.length !== data.width) {
        throw new ValidationError('Template tiles width must match specified width');
      }
    }

    // Validate tags
    if (data.tags) {
      if (!Array.isArray(data.tags)) {
        throw new ValidationError('Template tags must be an array');
      }

      if (data.tags.length > 10) {
        throw new ValidationError('Template cannot have more than 10 tags');
      }

      for (const tag of data.tags) {
        if (typeof tag !== 'string' || tag.length > 50) {
          throw new ValidationError('Each tag must be a string with 50 characters or less');
        }
      }
    }

    // Validate category
    if (data.category && typeof data.category !== 'string') {
      throw new ValidationError('Template category must be a string');
    }

    if (data.category && data.category.length > 50) {
      throw new ValidationError('Template category must be 50 characters or less');
    }
  }
}