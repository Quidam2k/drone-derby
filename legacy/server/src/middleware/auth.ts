import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserModel, PublicUserData } from '@/models/User';
import { logger } from '@/utils/logger';
import { AuthenticationError, AuthorizationError } from '@/middleware/errorHandler';

const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-change-this';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export interface AuthenticatedRequest extends Request {
  user?: PublicUserData;
  userId?: string;
}

export interface JwtPayload {
  userId: string;
  username: string;
  email: string;
  iat?: number;
  exp?: number;
}

export class AuthService {
  private userModel: UserModel;

  constructor() {
    this.userModel = new UserModel();
  }

  generateTokens(user: PublicUserData): { accessToken: string; refreshToken: string; expiresIn: number } {
    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      userId: user.id,
      username: user.username,
      email: user.email,
    };

    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    const refreshToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });

    // Calculate expiration time in seconds
    const decoded = jwt.decode(accessToken) as JwtPayload;
    const expiresIn = decoded.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 0;

    return {
      accessToken,
      refreshToken,
      expiresIn,
    };
  }

  verifyToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, JWT_SECRET) as JwtPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthenticationError('Token has expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthenticationError('Invalid token');
      } else {
        throw new AuthenticationError('Token verification failed');
      }
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    try {
      const payload = this.verifyToken(refreshToken);
      
      // Get fresh user data
      const user = await this.userModel.findById(payload.userId);
      if (!user) {
        throw new AuthenticationError('User not found');
      }

      const publicUser = this.userModel.toPublicData(user);
      const tokens = this.generateTokens(publicUser);

      return {
        accessToken: tokens.accessToken,
        expiresIn: tokens.expiresIn,
      };
    } catch (error) {
      logger.error('Error refreshing token:', error);
      throw new AuthenticationError('Invalid refresh token');
    }
  }
}

const authService = new AuthService();

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    throw new AuthenticationError('Access token required');
  }

  try {
    const payload = authService.verifyToken(token);
    req.userId = payload.userId;
    
    // Note: We're not loading full user data here for performance
    // Controllers can load user data as needed
    next();
  } catch (error) {
    next(error);
  }
}

export function authenticateOptional(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    // No token provided, but that's okay for optional auth
    next();
    return;
  }

  try {
    const payload = authService.verifyToken(token);
    req.userId = payload.userId;
    next();
  } catch (error) {
    // Invalid token for optional auth just means no user
    logger.warn('Invalid token in optional auth:', error);
    next();
  }
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.userId) {
    throw new AuthenticationError('Authentication required');
  }
  next();
}

export function requireRole(allowedRoles: string[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.userId) {
      throw new AuthenticationError('Authentication required');
    }

    try {
      const userModel = new UserModel();
      const user = await userModel.findById(req.userId);
      
      if (!user) {
        throw new AuthenticationError('User not found');
      }

      // For now, we'll implement a simple role system
      // Admin users are those with username 'admin' or email ending in '@dronderby.com'
      const isAdmin = user.username === 'admin' || user.email.endsWith('@dronderby.com');
      const userRoles = isAdmin ? ['admin', 'user'] : ['user'];

      const hasRequiredRole = allowedRoles.some(role => userRoles.includes(role));
      
      if (!hasRequiredRole) {
        throw new AuthorizationError(`Required role: ${allowedRoles.join(' or ')}`);
      }

      req.user = userModel.toPublicData(user);
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function loadUser(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.userId) {
    next();
    return;
  }

  const userModel = new UserModel();
  userModel.findById(req.userId)
    .then(user => {
      if (user) {
        req.user = userModel.toPublicData(user);
      }
      next();
    })
    .catch(error => {
      logger.error('Error loading user:', error);
      next(error);
    });
}

export { authService };