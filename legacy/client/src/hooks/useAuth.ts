import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { RootState, AppDispatch } from '@/store'
import { getCurrentUser, setTokens } from '@/store/slices/authSlice'
import { authService } from '@/services/authService'

export const useAuth = () => {
  const dispatch = useDispatch<AppDispatch>()
  const auth = useSelector((state: RootState) => state.auth)
  
  useEffect(() => {
    // Check for stored tokens on app initialization
    const initializeAuth = async () => {
      const storedTokens = authService.getStoredTokens()
      
      if (storedTokens?.accessToken) {
        // Validate token and get current user
        if (authService.isTokenValid(storedTokens.accessToken)) {
          dispatch(setTokens(storedTokens))
          
          try {
            await dispatch(getCurrentUser()).unwrap()
            // Schedule token refresh
            authService.scheduleTokenRefresh()
          } catch (error) {
            console.error('Failed to get current user:', error)
            // Token might be invalid, clear it
            authService.logout()
          }
        } else {
          // Token expired, try to refresh
          if (storedTokens.refreshToken) {
            try {
              await authService.refreshToken(storedTokens.refreshToken)
              await dispatch(getCurrentUser()).unwrap()
              authService.scheduleTokenRefresh()
            } catch (error) {
              console.error('Failed to refresh token:', error)
              authService.logout()
            }
          } else {
            authService.logout()
          }
        }
      }
    }
    
    initializeAuth()
  }, [dispatch])
  
  return {
    user: auth.user,
    tokens: auth.tokens,
    isAuthenticated: auth.isAuthenticated,
    isLoading: auth.isLoading,
    error: auth.error,
    loginAttempts: auth.loginAttempts,
    lastLoginAttempt: auth.lastLoginAttempt,
  }
}