import { Router } from 'express'
import { AuthController } from '../controllers/authController'
import { authenticateToken } from '../middleware/auth'
import { rateLimiter } from '../middleware/rateLimiter'

const router = Router()

// Public routes (no authentication required)
router.post('/register', rateLimiter, AuthController.register)
router.post('/login', rateLimiter, AuthController.login)
router.post('/refresh', rateLimiter, AuthController.refresh)
router.post('/forgot-password', rateLimiter, AuthController.forgotPassword)
router.post('/reset-password', rateLimiter, AuthController.resetPassword)

// Protected routes (authentication required)
router.get('/me', authenticateToken, AuthController.getMe)
router.put('/profile', authenticateToken, AuthController.updateProfile)
router.post('/change-password', authenticateToken, AuthController.changePassword)
router.post('/logout', authenticateToken, AuthController.logout)

export default router