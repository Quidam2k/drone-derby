import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { BaseModel, BaseModelData, PaginationOptions } from './BaseModel';
import { logger } from '../utils/logger';
import { ValidationError, ConflictError } from '../middleware/errorHandler';

export interface UserData extends BaseModelData {
  username: string;
  email: string;
  password_hash: string;
  display_name: string;
  avatar?: string;
  games_played: number;
  games_won: number;
  win_rate: number;
  average_turns: number;
  total_play_time: number;
  last_login_at?: Date;
}

export interface CreateUserData {
  username: string;
  email: string;
  password: string;
  display_name: string;
  avatar?: string;
}

export interface UserStats {
  games_played: number;
  games_won: number;
  win_rate: number;
  average_turns: number;
  total_play_time: number;
}

export interface PublicUserData {
  id: string;
  username: string;
  display_name: string;
  avatar?: string;
  stats: UserStats;
  created_at: Date;
  last_login_at?: Date;
}

export class UserModel extends BaseModel<UserData> {
  protected tableName = 'users';

  async create(data: CreateUserData): Promise<UserData> {
    // Validate input
    await this.validateUserData(data);

    // Hash password
    const saltRounds = 12;
    const password_hash = await bcrypt.hash(data.password, saltRounds);

    const userData = {
      ...data,
      password_hash,
      games_played: 0,
      games_won: 0,
      win_rate: 0,
      average_turns: 0,
      total_play_time: 0,
    };

    // Remove plain password from data
    const { password, ...userDataWithoutPassword } = userData;

    return super.create(userDataWithoutPassword);
  }

  async findByEmail(email: string): Promise<UserData | null> {
    try {
      const result = await this.db(this.tableName)
        .where({ email: email.toLowerCase() })
        .first();
      
      return result || null;
    } catch (error) {
      logger.error('Error finding user by email:', error);
      throw error;
    }
  }

  async findByUsername(username: string): Promise<UserData | null> {
    try {
      const result = await this.db(this.tableName)
        .where({ username: username.toLowerCase() })
        .first();
      
      return result || null;
    } catch (error) {
      logger.error('Error finding user by username:', error);
      throw error;
    }
  }

  async validatePassword(password: string, hash: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      logger.error('Error validating password:', error);
      return false;
    }
  }

  async updatePassword(id: string, newPassword: string): Promise<boolean> {
    try {
      const saltRounds = 12;
      const password_hash = await bcrypt.hash(newPassword, saltRounds);
      
      const result = await this.update(id, { password_hash });
      return !!result;
    } catch (error) {
      logger.error('Error updating password:', error);
      throw error;
    }
  }

  async updateLastLogin(id: string): Promise<void> {
    try {
      await this.db(this.tableName)
        .where({ id })
        .update({ last_login_at: new Date() });
    } catch (error) {
      logger.error('Error updating last login:', error);
      throw error;
    }
  }

  async updateStats(id: string, stats: Partial<UserStats>): Promise<UserData | null> {
    try {
      // Calculate win rate if games_played and games_won are provided
      const updatedStats = { ...stats };
      if (stats.games_played && stats.games_won !== undefined) {
        updatedStats.win_rate = stats.games_won / stats.games_played;
      }

      return await this.update(id, updatedStats);
    } catch (error) {
      logger.error('Error updating user stats:', error);
      throw error;
    }
  }

  async searchUsers(query: string, options: PaginationOptions = {}): Promise<{
    items: PublicUserData[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const {
        page = 1,
        limit = 20,
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = options;

      const offset = (page - 1) * limit;

      // Build search query
      const searchCondition = this.db(this.tableName)
        .where('username', 'ilike', `%${query}%`)
        .orWhere('display_name', 'ilike', `%${query}%`);

      // Get total count
      const [{ count }] = await searchCondition.clone().count('* as count');
      const total = parseInt(count as string, 10);

      // Get paginated results
      const users = await searchCondition
        .select('id', 'username', 'display_name', 'avatar', 'games_played', 
                'games_won', 'win_rate', 'average_turns', 'total_play_time', 
                'created_at', 'last_login_at')
        .orderBy(sortBy, sortOrder)
        .limit(limit)
        .offset(offset);

      // Transform to public format
      const items: PublicUserData[] = users.map(user => ({
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        avatar: user.avatar,
        stats: {
          games_played: user.games_played,
          games_won: user.games_won,
          win_rate: user.win_rate,
          average_turns: user.average_turns,
          total_play_time: user.total_play_time,
        },
        created_at: user.created_at,
        last_login_at: user.last_login_at,
      }));

      return {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      logger.error('Error searching users:', error);
      throw error;
    }
  }

  toPublicData(user: UserData): PublicUserData {
    return {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      avatar: user.avatar,
      stats: {
        games_played: user.games_played,
        games_won: user.games_won,
        win_rate: user.win_rate,
        average_turns: user.average_turns,
        total_play_time: user.total_play_time,
      },
      created_at: user.created_at,
      last_login_at: user.last_login_at,
    };
  }

  private async validateUserData(data: CreateUserData): Promise<void> {
    // Validate username
    if (!data.username || data.username.length < 3 || data.username.length > 50) {
      throw new ValidationError('Username must be between 3 and 50 characters');
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(data.username)) {
      throw new ValidationError('Username can only contain letters, numbers, underscores, and hyphens');
    }

    // Validate email
    if (!data.email || !this.isValidEmail(data.email)) {
      throw new ValidationError('Invalid email address');
    }

    // Validate password
    if (!data.password || data.password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long');
    }

    // Validate display name
    if (!data.display_name || data.display_name.length < 2 || data.display_name.length > 100) {
      throw new ValidationError('Display name must be between 2 and 100 characters');
    }

    // Check for existing username
    const existingUsername = await this.findByUsername(data.username);
    if (existingUsername) {
      throw new ConflictError('Username already exists');
    }

    // Check for existing email
    const existingEmail = await this.findByEmail(data.email);
    if (existingEmail) {
      throw new ConflictError('Email already exists');
    }
  }

  async generatePasswordResetToken(userId: string): Promise<string> {
    try {
      // Generate a secure random token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
      
      // Store the token in the database (you may want to create a separate table for this)
      // For now, we'll use Redis or a simple in-memory store
      // In production, consider using a dedicated password_reset_tokens table
      const resetData = {
        user_id: userId,
        token: token,
        expires_at: expiresAt,
        used: false,
      };
      
      // For now, we'll store it in a way that can be retrieved
      // You should implement proper token storage (Redis, separate table, etc.)
      // This is a simplified implementation
      await this.db.raw(
        'INSERT INTO password_reset_tokens (user_id, token, expires_at, used) VALUES (?, ?, ?, ?) ON CONFLICT (user_id) DO UPDATE SET token = EXCLUDED.token, expires_at = EXCLUDED.expires_at, used = EXCLUDED.used',
        [userId, token, expiresAt, false]
      );
      
      return token;
    } catch (error) {
      logger.error('Error generating password reset token:', error);
      throw error;
    }
  }

  async verifyPasswordResetToken(token: string): Promise<string | null> {
    try {
      const result = await this.db('password_reset_tokens')
        .where({ token, used: false })
        .where('expires_at', '>', new Date())
        .first();
      
      return result ? result.user_id : null;
    } catch (error) {
      logger.error('Error verifying password reset token:', error);
      return null;
    }
  }

  async invalidatePasswordResetToken(token: string): Promise<void> {
    try {
      await this.db('password_reset_tokens')
        .where({ token })
        .update({ used: true });
    } catch (error) {
      logger.error('Error invalidating password reset token:', error);
      throw error;
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}