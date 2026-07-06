import { Express, Request, Response } from 'express'
import authRoutes from './authRoutes'
import boardRoutes from './boardRoutes'
import gameRoutes from './gameRoutes'

export function setupRoutes(app: Express) {
  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.json({
      success: true,
      message: 'Drone Derby API is running',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    })
  })

  // API routes
  app.use('/api/auth', authRoutes)
  app.use('/api/boards', boardRoutes)
  app.use('/api/games', gameRoutes)

  // 404 handler for unknown routes
  app.use('/api/*', (req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: 'API endpoint not found',
      path: req.path,
    })
  })

  // Root endpoint
  app.get('/', (req: Request, res: Response) => {
    res.json({
      success: true,
      message: 'Welcome to Drone Derby API',
      documentation: '/api/docs', // TODO: Add API documentation
      health: '/health',
    })
  })
}