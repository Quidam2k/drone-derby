import { Router } from 'express'
import { BoardController } from '../controllers/boardController'
import { authenticateToken } from '../middleware/auth'
import { rateLimiter } from '../middleware/rateLimiter'

const router = Router()

// Public routes
router.get('/public', BoardController.getPublicBoards)
router.get('/search', BoardController.searchBoards)
router.post('/validate', BoardController.validateBoard)

// Protected routes
router.post('/', authenticateToken, rateLimiter, BoardController.createBoard)
router.get('/user', authenticateToken, BoardController.getUserBoards)
router.get('/:id', authenticateToken, BoardController.getBoard)
router.put('/:id', authenticateToken, rateLimiter, BoardController.updateBoard)
router.delete('/:id', authenticateToken, BoardController.deleteBoard)
router.post('/:id/duplicate', authenticateToken, rateLimiter, BoardController.duplicateBoard)
router.post('/:id/rate', authenticateToken, rateLimiter, BoardController.rateBoard)

export default router