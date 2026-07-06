import { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { RootState } from '@/store'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

interface ProtectedRouteProps {
  children: ReactNode
  requiredRole?: string[]
}

const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading, user } = useSelector((state: RootState) => state.auth)
  const location = useLocation()
  
  if (isLoading) {
    return <LoadingSpinner message="Checking authentication..." />
  }
  
  if (!isAuthenticated) {
    // Redirect to login page with return url
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  
  // Check role requirements if specified
  if (requiredRole && user) {
    const userRoles = user.username === 'admin' || user.email.endsWith('@dronderby.com') 
      ? ['admin', 'user'] 
      : ['user']
    
    const hasRequiredRole = requiredRole.some(role => userRoles.includes(role))
    
    if (!hasRequiredRole) {
      return <Navigate to="/dashboard" replace />
    }
  }
  
  return <>{children}</>
}

export default ProtectedRoute