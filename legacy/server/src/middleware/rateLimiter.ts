import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { logger } from '@/utils/logger';
import { RateLimitError } from '@/middleware/errorHandler';

const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW || '15') * 60 * 1000; // minutes to ms
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100');

// Global rate limiter
export const rateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW,
  max: RATE_LIMIT_MAX_REQUESTS,
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later',
    retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000),
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req: Request): string => {
    // Use user ID if authenticated, otherwise fall back to IP
    return req.user?.id || req.ip;
  },
  handler: (req: Request, res: Response): void => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      userId: req.user?.id,
      url: req.url,
      method: req.method,
    });

    throw new RateLimitError('Too many requests, please try again later');
  },
});

// Strict rate limiter for authentication endpoints
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later',
    retryAfter: 15 * 60, // 15 minutes in seconds
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    // Use email from request body if available, otherwise IP
    return req.body?.email || req.ip;
  },
  handler: (req: Request, res: Response): void => {
    logger.warn('Auth rate limit exceeded', {
      ip: req.ip,
      email: req.body?.email,
      url: req.url,
      method: req.method,
    });

    throw new RateLimitError('Too many authentication attempts, please try again later');
  },
});

// Game action rate limiter - prevent spam clicking
export const gameActionRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 actions per minute
  message: {
    success: false,
    error: 'Too many game actions, please slow down',
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    return req.user?.id || req.ip;
  },
  handler: (req: Request, res: Response): void => {
    logger.warn('Game action rate limit exceeded', {
      ip: req.ip,
      userId: req.user?.id,
      url: req.url,
      method: req.method,
    });

    throw new RateLimitError('Too many game actions, please slow down');
  },
});

// Board creation rate limiter - prevent spam board creation
export const boardCreationRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5, // 5 boards per 10 minutes
  message: {
    success: false,
    error: 'Too many board creations, please wait before creating more',
    retryAfter: 10 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    return req.user?.id || req.ip;
  },
  handler: (req: Request, res: Response): void => {
    logger.warn('Board creation rate limit exceeded', {
      ip: req.ip,
      userId: req.user?.id,
      url: req.url,
      method: req.method,
    });

    throw new RateLimitError('Too many board creations, please wait before creating more');
  },
});

// Template creation rate limiter
export const templateCreationRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 templates per 5 minutes
  message: {
    success: false,
    error: 'Too many template creations, please wait',
    retryAfter: 5 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request): string => {
    return req.user?.id || req.ip;
  },
  handler: (req: Request, res: Response): void => {
    logger.warn('Template creation rate limit exceeded', {
      ip: req.ip,
      userId: req.user?.id,
      url: req.url,
      method: req.method,
    });

    throw new RateLimitError('Too many template creations, please wait');
  },
});