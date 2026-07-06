import { 
  User, 
  AuthTokens, 
  LoginRequest, 
  RegisterRequest, 
  ApiResponse 
} from '@/shared/types/api'
import { apiClient } from './api'

export class AuthService {
  private readonly TOKEN_KEY = 'drone_derby_tokens'
  
  async login(credentials: LoginRequest): Promise<{ user: User; tokens: AuthTokens }> {
    const response = await apiClient.post<ApiResponse<{ user: User; tokens: AuthTokens }>>(
      '/auth/login',
      credentials
    )
    
    if (response.success && response.data) {
      this.storeTokens(response.data.tokens)
      return response.data
    }
    
    throw new Error(response.error || 'Login failed')
  }
  
  async register(userData: RegisterRequest): Promise<{ user: User; tokens: AuthTokens }> {
    const response = await apiClient.post<ApiResponse<{ user: User; tokens: AuthTokens }>>(
      '/auth/register',
      userData
    )
    
    if (response.success && response.data) {
      this.storeTokens(response.data.tokens)
      return response.data
    }
    
    throw new Error(response.error || 'Registration failed')
  }
  
  async refreshToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    const response = await apiClient.post<ApiResponse<{ accessToken: string; expiresIn: number }>>(
      '/auth/refresh',
      { refreshToken }
    )
    
    if (response.success && response.data) {
      // Update stored tokens
      const currentTokens = this.getStoredTokens()
      if (currentTokens) {
        const updatedTokens = {
          ...currentTokens,
          accessToken: response.data.accessToken,
          expiresIn: response.data.expiresIn,
        }
        this.storeTokens(updatedTokens)
      }
      
      return response.data
    }
    
    throw new Error(response.error || 'Token refresh failed')
  }
  
  async getCurrentUser(): Promise<User> {
    const response = await apiClient.get<ApiResponse<User>>('/auth/me')
    
    if (response.success && response.data) {
      return response.data
    }
    
    throw new Error(response.error || 'Failed to get current user')
  }
  
  async updateProfile(userData: Partial<User>): Promise<User> {
    const response = await apiClient.put<ApiResponse<User>>('/auth/profile', userData)
    
    if (response.success && response.data) {
      return response.data
    }
    
    throw new Error(response.error || 'Failed to update profile')
  }
  
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    const response = await apiClient.post<ApiResponse<void>>('/auth/change-password', {
      currentPassword,
      newPassword,
    })
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to change password')
    }
  }
  
  async forgotPassword(email: string): Promise<void> {
    const response = await apiClient.post<ApiResponse<void>>('/auth/forgot-password', {
      email,
    })
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to send password reset email')
    }
  }
  
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const response = await apiClient.post<ApiResponse<void>>('/auth/reset-password', {
      token,
      newPassword,
    })
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to reset password')
    }
  }
  
  async logout(): Promise<void> {
    try {
      // Call logout endpoint to invalidate server-side session
      await apiClient.post('/auth/logout')
    } catch (error) {
      // Continue with logout even if server call fails
      console.warn('Failed to logout on server:', error)
    } finally {
      // Always clear local storage
      this.clearTokens()
    }
  }
  
  // Token management
  private storeTokens(tokens: AuthTokens): void {
    try {
      localStorage.setItem(this.TOKEN_KEY, JSON.stringify(tokens))
    } catch (error) {
      console.error('Failed to store tokens:', error)
    }
  }
  
  getStoredTokens(): AuthTokens | null {
    try {
      const stored = localStorage.getItem(this.TOKEN_KEY)
      return stored ? JSON.parse(stored) : null
    } catch (error) {
      console.error('Failed to get stored tokens:', error)
      return null
    }
  }
  
  private clearTokens(): void {
    try {
      localStorage.removeItem(this.TOKEN_KEY)
    } catch (error) {
      console.error('Failed to clear tokens:', error)
    }
  }
  
  // Token validation
  isTokenValid(token: string): boolean {
    try {
      // Simple JWT structure validation
      const parts = token.split('.')
      if (parts.length !== 3) return false
      
      // Decode payload to check expiration
      const payload = JSON.parse(atob(parts[1]))
      const now = Math.floor(Date.now() / 1000)
      
      return payload.exp > now
    } catch (error) {
      return false
    }
  }
  
  isAuthenticated(): boolean {
    const tokens = this.getStoredTokens()
    return !!(tokens?.accessToken && this.isTokenValid(tokens.accessToken))
  }
  
  // Auto-refresh token before expiration
  scheduleTokenRefresh(): void {
    const tokens = this.getStoredTokens()
    if (!tokens?.accessToken) return
    
    try {
      const payload = JSON.parse(atob(tokens.accessToken.split('.')[1]))
      const expiresAt = payload.exp * 1000 // Convert to milliseconds
      const now = Date.now()
      const timeUntilExpiry = expiresAt - now
      
      // Refresh 5 minutes before expiration
      const refreshTime = Math.max(timeUntilExpiry - 5 * 60 * 1000, 0)
      
      if (refreshTime > 0) {
        setTimeout(() => {
          if (tokens.refreshToken) {
            this.refreshToken(tokens.refreshToken).catch(error => {
              console.error('Auto token refresh failed:', error)
            })
          }
        }, refreshTime)
      }
    } catch (error) {
      console.error('Failed to schedule token refresh:', error)
    }
  }
}

export const authService = new AuthService()