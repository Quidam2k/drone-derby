import { Request, Response, NextFunction } from 'express'
import { UserModel } from '../models/User'
import { generateTokens, verifyRefreshToken } from '../middleware/auth'
import { ValidationError, AuthenticationError } from '../middleware/errorHandler'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

// Create a User model instance
const User = new UserModel()

// Validation schemas
const registerSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email(),
  password: z.string().min(6).max(100),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const changePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(6).max(100),
})

const updateProfileSchema = z.object({
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/).optional(),
  email: z.string().email().optional(),
})

const forgotPasswordSchema = z.object({
  email: z.string().email(),
})

const resetPasswordSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(6).max(100),
})

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedData = registerSchema.parse(req.body)
      
      // Check if user already exists
      const existingUser = await User.findByEmail(validatedData.email)
      if (existingUser) {
        throw new ValidationError('User with this email already exists')
      }

      // Check if username is taken
      const existingUsername = await User.findByUsername(validatedData.username)
      if (existingUsername) {
        throw new ValidationError('Username is already taken')
      }

      // Create new user
      const user = await User.create({
        username: validatedData.username,
        email: validatedData.email,
        password: validatedData.password,
        role: 'user',
        display_name: validatedData.username,
      })

      // Generate tokens
      const tokens = generateTokens(user.id, user.role)

      // Return user data without password
      const { password_hash, ...userWithoutPassword } = user
      
      res.status(201).json({
        success: true,
        data: {
          user: userWithoutPassword,
          ...tokens,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedData = loginSchema.parse(req.body)
      
      // Find user by email
      const user = await User.findByEmail(validatedData.email)
      if (!user) {
        throw new AuthenticationError('Invalid email or password')
      }

      // Verify password
      const isValidPassword = await User.validatePassword(validatedData.password, user.password_hash)
      if (!isValidPassword) {
        throw new AuthenticationError('Invalid email or password')
      }

      // Update last login
      await User.updateLastLogin(user.id)

      // Generate tokens
      const tokens = generateTokens(user.id, user.role)

      // Return user data without password
      const { password_hash, ...userWithoutPassword } = user
      
      res.json({
        success: true,
        data: {
          user: userWithoutPassword,
          ...tokens,
        },
      })
    } catch (error) {
      next(error)
    }
  }

  static async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body
      
      if (!refreshToken) {
        throw new AuthenticationError('Refresh token is required')
      }

      // Verify refresh token
      const decoded = verifyRefreshToken(refreshToken)
      
      // Find user
      const user = await User.findById(decoded.userId)
      if (!user) {
        throw new AuthenticationError('Invalid refresh token')
      }

      // Generate new tokens
      const tokens = generateTokens(user.id, user.role)
      
      res.json({
        success: true,
        data: tokens,
      })
    } catch (error) {
      next(error)
    }
  }

  static async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id
      if (!userId) {
        throw new AuthenticationError('User not authenticated')
      }

      const user = await User.findById(userId)
      if (!user) {
        throw new AuthenticationError('User not found')
      }

      // Return user data without password
      const { password_hash, ...userWithoutPassword } = user
      
      res.json({
        success: true,
        data: { user: userWithoutPassword },
      })
    } catch (error) {
      next(error)
    }
  }

  static async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id
      if (!userId) {
        throw new AuthenticationError('User not authenticated')
      }

      const validatedData = updateProfileSchema.parse(req.body)
      
      // Check if username is already taken (if changing username)
      if (validatedData.username) {
        const existingUser = await User.findByUsername(validatedData.username)
        if (existingUser && existingUser.id !== userId) {
          throw new ValidationError('Username is already taken')
        }
      }

      // Check if email is already taken (if changing email)
      if (validatedData.email) {
        const existingUser = await User.findByEmail(validatedData.email)
        if (existingUser && existingUser.id !== userId) {
          throw new ValidationError('Email is already taken')
        }
      }

      // Update user
      const updatedUser = await User.update(userId, validatedData)
      
      // Return updated user data without password
      const { password_hash, ...userWithoutPassword } = updatedUser
      
      res.json({
        success: true,
        data: { user: userWithoutPassword },
      })
    } catch (error) {
      next(error)
    }
  }

  static async changePassword(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id
      if (!userId) {
        throw new AuthenticationError('User not authenticated')
      }

      const validatedData = changePasswordSchema.parse(req.body)
      
      // Get current user
      const user = await User.findById(userId)
      if (!user) {
        throw new AuthenticationError('User not found')
      }

      // Verify current password
      const isValidPassword = await User.validatePassword(validatedData.currentPassword, user.password_hash)
      if (!isValidPassword) {
        throw new ValidationError('Current password is incorrect')
      }

      // Update password
      await User.updatePassword(userId, validatedData.newPassword)
      
      res.json({
        success: true,
        message: 'Password updated successfully',
      })
    } catch (error) {
      next(error)
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction) {
    try {
      // In a production app, you might want to blacklist the tokens
      // For now, we'll just return success - client will remove tokens
      res.json({
        success: true,
        message: 'Logged out successfully',
      })
    } catch (error) {
      next(error)
    }
  }

  static async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedData = forgotPasswordSchema.parse(req.body)
      
      // Check if user exists
      const user = await User.findByEmail(validatedData.email)
      
      // Always return success to prevent email enumeration
      // but only send email if user exists
      if (user) {
        // Generate password reset token
        const resetToken = await User.generatePasswordResetToken(user.id)
        
        // In a real application, you would send an email here
        // For now, we'll just log the token (remove in production)
        console.log(`Password reset token for ${user.email}: ${resetToken}`)
        
        // TODO: Send password reset email
        // await emailService.sendPasswordResetEmail(user.email, resetToken)
      }
      
      res.json({
        success: true,
        message: 'If an account with that email exists, we\'ve sent you a password reset link.',
      })
    } catch (error) {
      next(error)
    }
  }

  static async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const validatedData = resetPasswordSchema.parse(req.body)
      
      // Verify reset token and get user ID
      const userId = await User.verifyPasswordResetToken(validatedData.token)
      if (!userId) {
        throw new ValidationError('Invalid or expired reset token')
      }
      
      // Update password
      await User.updatePassword(userId, validatedData.newPassword)
      
      // Invalidate the reset token
      await User.invalidatePasswordResetToken(validatedData.token)
      
      res.json({
        success: true,
        message: 'Password has been reset successfully',
      })
    } catch (error) {
      next(error)
    }
  }
}