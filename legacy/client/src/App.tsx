import { Routes, Route, Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { Box } from '@mui/material'

import { RootState } from '@/store'
import { useAuth } from '@/hooks/useAuth'
import { useWebSocket } from '@/hooks/useWebSocket'

import Layout from '@/components/layout/Layout'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

// Pages
import HomePage from '@/pages/HomePage'
import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage'
import DashboardPage from '@/pages/DashboardPage'
import GamePage from '@/pages/game/GamePage'
import GameLobbyPage from '@/pages/game/GameLobbyPage'
import LevelEditorPage from '@/pages/editor/LevelEditorPage'
import BoardBrowserPage from '@/pages/boards/BoardBrowserPage'
import BoardDetailPage from '@/pages/boards/BoardDetailPage'
import TemplateBrowserPage from '@/pages/templates/TemplateBrowserPage'
import ProfilePage from '@/pages/ProfilePage'
import SettingsPage from '@/pages/SettingsPage'
import NotFoundPage from '@/pages/NotFoundPage'

function App() {
  const { isAuthenticated, user, isLoading } = useSelector((state: RootState) => state.auth)
  
  // Initialize authentication check
  useAuth()
  
  // Initialize WebSocket connection for authenticated users
  useWebSocket(isAuthenticated)

  if (isLoading) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        minHeight="100vh"
      >
        <LoadingSpinner />
      </Box>
    )
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/"
        element={
          <Layout>
            <HomePage />
          </Layout>
        }
      />
      
      <Route
        path="/login"
        element={
          isAuthenticated ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <Layout showHeader={false}>
              <LoginPage />
            </Layout>
          )
        }
      />
      
      <Route
        path="/register"
        element={
          isAuthenticated ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <Layout showHeader={false}>
              <RegisterPage />
            </Layout>
          )
        }
      />
      
      <Route
        path="/forgot-password"
        element={
          isAuthenticated ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <Layout showHeader={false}>
              <ForgotPasswordPage />
            </Layout>
          )
        }
      />

      {/* Public board and template browsing */}
      <Route
        path="/boards"
        element={
          <Layout>
            <BoardBrowserPage />
          </Layout>
        }
      />
      
      <Route
        path="/boards/:boardId"
        element={
          <Layout>
            <BoardDetailPage />
          </Layout>
        }
      />
      
      <Route
        path="/templates"
        element={
          <Layout>
            <TemplateBrowserPage />
          </Layout>
        }
      />

      {/* Protected routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout>
              <DashboardPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/games/:gameId"
        element={
          <ProtectedRoute>
            <Layout showHeader={false} showSidebar={false}>
              <GamePage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/games/:gameId/lobby"
        element={
          <ProtectedRoute>
            <Layout>
              <GameLobbyPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/editor"
        element={
          <ProtectedRoute>
            <Layout showSidebar={false}>
              <LevelEditorPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/editor/:boardId"
        element={
          <ProtectedRoute>
            <Layout showSidebar={false}>
              <LevelEditorPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Layout>
              <ProfilePage />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Layout>
              <SettingsPage />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Catch all route */}
      <Route
        path="*"
        element={
          <Layout>
            <NotFoundPage />
          </Layout>
        }
      />
    </Routes>
  )
}

export default App