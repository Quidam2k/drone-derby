import { Router } from 'express'
import { GameController } from '../controllers/gameController'
import { authenticateToken } from '../middleware/auth'
import { rateLimiter } from '../middleware/rateLimiter'

const router = Router()

// All game routes require authentication
router.use(authenticateToken)

// Game management
router.post('/', rateLimiter, GameController.createGame)
router.get('/available', GameController.getAvailableGames)
router.get('/user', GameController.getUserGames)
router.get('/:id', GameController.getGame)
router.post('/:id/join', rateLimiter, GameController.joinGame)
router.post('/:id/start', rateLimiter, GameController.startGame)
router.post('/:id/submit-turn', rateLimiter, GameController.submitTurn)

export default router