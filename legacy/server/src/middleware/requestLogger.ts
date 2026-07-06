import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface LoggedRequest extends Request {
  requestId: string;
  startTime: number;
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const loggedReq = req as LoggedRequest;
  
  // Generate unique request ID
  loggedReq.requestId = uuidv4();
  loggedReq.startTime = Date.now();
  
  // Add request ID to headers for tracking
  res.setHeader('X-Request-ID', loggedReq.requestId);
  
  // Log request start
  logger.info('Request started', {
    requestId: loggedReq.requestId,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    userId: req.user?.id,
  });
  
  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(...args: Parameters<typeof originalEnd>): Response {
    const duration = Date.now() - loggedReq.startTime;
    
    // Log response
    logger.info('Request completed', {
      requestId: loggedReq.requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      userId: req.user?.id,
      contentLength: res.get('Content-Length'),
    });
    
    // Call original end method
    originalEnd.apply(this, args);
    return this;
  };
  
  next();
}