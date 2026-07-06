import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';
import { ApiResponse } from '../../../shared/types/api';

export interface CustomError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown;
}

export class AppError extends Error implements CustomError {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    details?: unknown
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = 'AppError';

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

export function errorHandler(
  error: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // If response was already sent, delegate to default Express error handler
  if (res.headersSent) {
    next(error);
    return;
  }

  const statusCode = error.statusCode || 500;
  const code = error.code || 'INTERNAL_ERROR';
  const message = error.message || 'Internal server error';

  // Log error details
  if (statusCode >= 500) {
    logger.error('Server error:', {
      error: error.message,
      stack: error.stack,
      statusCode,
      code,
      url: req.url,
      method: req.method,
      userId: req.user?.id,
      requestId: req.headers['x-request-id'],
    });
  } else {
    logger.warn('Client error:', {
      error: error.message,
      statusCode,
      code,
      url: req.url,
      method: req.method,
      userId: req.user?.id,
    });
  }

  // Prepare error response
  const response: ApiResponse = {
    success: false,
    error: message,
  };

  // Include error details in development
  if (process.env.NODE_ENV === 'development') {
    response.data = {
      code,
      details: error.details,
      stack: error.stack,
    };
  }

  res.status(statusCode).json(response);
}

// Async error wrapper
export function asyncHandler<T extends Request, U extends Response>(
  fn: (req: T, res: U, next: NextFunction) => Promise<void>
): (req: T, res: U, next: NextFunction) => void {
  return (req: T, res: U, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Global error types for specific database/external service errors
export function handleDatabaseError(error: unknown): AppError {
  if (error instanceof Error) {
    // PostgreSQL specific errors
    if ('code' in error) {
      switch ((error as { code: string }).code) {
        case '23505': // unique_violation
          return new ConflictError('Resource already exists');
        case '23503': // foreign_key_violation
          return new ValidationError('Referenced resource does not exist');
        case '23502': // not_null_violation
          return new ValidationError('Required field is missing');
        case '23514': // check_violation
          return new ValidationError('Invalid data format');
        default:
          break;
      }
    }

    return new AppError(error.message, 500, 'DATABASE_ERROR');
  }

  return new AppError('Unknown database error', 500, 'DATABASE_ERROR');
}

export function handleRedisError(error: unknown): AppError {
  if (error instanceof Error) {
    return new AppError(`Cache error: ${error.message}`, 500, 'CACHE_ERROR');
  }
  return new AppError('Unknown cache error', 500, 'CACHE_ERROR');
}