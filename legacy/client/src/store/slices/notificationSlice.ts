import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { NotificationMessage } from '@/shared/types/api'
import { notificationService } from '@/services/notificationService'

export interface NotificationState {
  // Notifications from server
  notifications: Array<{
    id: string
    type: 'game_invitation' | 'game_started' | 'turn_ready' | 'turn_complete' | 'game_complete' | 'player_joined' | 'player_left' | 'board_shared' | 'template_shared' | 'system_announcement'
    level: 'info' | 'success' | 'warning' | 'error'
    title: string
    message: string
    data?: unknown
    isRead: boolean
    isDismissed: boolean
    actionUrl?: string
    actionText?: string
    createdAt: Date
    expiresAt?: Date
  }>
  
  // Real-time notifications (WebSocket)
  realtimeNotifications: NotificationMessage[]
  
  // UI state
  isLoading: boolean
  error: string | null
  
  // Settings
  settings: {
    emailEnabled: boolean
    pushEnabled: boolean
    gameNotifications: boolean
    socialNotifications: boolean
    systemNotifications: boolean
    soundEnabled: boolean
  }
  
  // Unread counts
  unreadCount: number
  unreadGameCount: number
  unreadSocialCount: number
}

const initialState: NotificationState = {
  notifications: [],
  realtimeNotifications: [],
  isLoading: false,
  error: null,
  settings: {
    emailEnabled: true,
    pushEnabled: true,
    gameNotifications: true,
    socialNotifications: true,
    systemNotifications: true,
    soundEnabled: true,
  },
  unreadCount: 0,
  unreadGameCount: 0,
  unreadSocialCount: 0,
}

// Async thunks
export const getNotifications = createAsyncThunk(
  'notification/getNotifications',
  async ({ page = 1, limit = 20 }: { page?: number; limit?: number }, { rejectWithValue }) => {
    try {
      const result = await notificationService.getNotifications({ page, limit })
      return result
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to get notifications')
    }
  }
)

export const markAsRead = createAsyncThunk(
  'notification/markAsRead',
  async (notificationId: string, { rejectWithValue }) => {
    try {
      await notificationService.markAsRead(notificationId)
      return notificationId
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to mark as read')
    }
  }
)

export const markAllAsRead = createAsyncThunk(
  'notification/markAllAsRead',
  async (_, { rejectWithValue }) => {
    try {
      await notificationService.markAllAsRead()
      return true
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to mark all as read')
    }
  }
)

export const dismissNotification = createAsyncThunk(
  'notification/dismissNotification',
  async (notificationId: string, { rejectWithValue }) => {
    try {
      await notificationService.dismissNotification(notificationId)
      return notificationId
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to dismiss notification')
    }
  }
)

export const updateNotificationSettings = createAsyncThunk(
  'notification/updateSettings',
  async (settings: Partial<NotificationState['settings']>, { rejectWithValue }) => {
    try {
      const updatedSettings = await notificationService.updateSettings(settings)
      return updatedSettings
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to update settings')
    }
  }
)

const notificationSlice = createSlice({
  name: 'notification',
  initialState,
  reducers: {
    // Real-time notification handling
    addRealtimeNotification: (state, action: PayloadAction<NotificationMessage>) => {
      state.realtimeNotifications.unshift(action.payload)
      
      // Limit to 50 real-time notifications
      if (state.realtimeNotifications.length > 50) {
        state.realtimeNotifications = state.realtimeNotifications.slice(0, 50)
      }
      
      // Update unread counts based on notification type
      if (action.payload.type.startsWith('game_') || action.payload.type === 'turn_ready' || action.payload.type === 'turn_complete') {
        state.unreadGameCount += 1
      } else if (action.payload.type === 'player_joined' || action.payload.type === 'player_left') {
        state.unreadSocialCount += 1
      }
      
      state.unreadCount += 1
    },
    
    removeRealtimeNotification: (state, action: PayloadAction<string>) => {
      state.realtimeNotifications = state.realtimeNotifications.filter(
        n => n.payload.id !== action.payload
      )
    },
    
    clearRealtimeNotifications: (state) => {
      state.realtimeNotifications = []
    },
    
    // Local notification management
    markNotificationAsRead: (state, action: PayloadAction<string>) => {
      const notification = state.notifications.find(n => n.id === action.payload)
      if (notification && !notification.isRead) {
        notification.isRead = true
        state.unreadCount = Math.max(0, state.unreadCount - 1)
        
        // Update category counts
        if (notification.type.includes('game') || notification.type === 'turn_ready' || notification.type === 'turn_complete') {
          state.unreadGameCount = Math.max(0, state.unreadGameCount - 1)
        } else if (notification.type === 'player_joined' || notification.type === 'player_left') {
          state.unreadSocialCount = Math.max(0, state.unreadSocialCount - 1)
        }
      }
    },
    
    markNotificationAsDismissed: (state, action: PayloadAction<string>) => {
      const notification = state.notifications.find(n => n.id === action.payload)
      if (notification) {
        notification.isDismissed = true
      }
    },
    
    // Settings management
    updateSettingsLocal: (state, action: PayloadAction<Partial<NotificationState['settings']>>) => {
      Object.assign(state.settings, action.payload)
    },
    
    // Error handling
    clearError: (state) => {
      state.error = null
    },
    
    // Bulk operations
    clearAllNotifications: (state) => {
      state.notifications = []
      state.realtimeNotifications = []
      state.unreadCount = 0
      state.unreadGameCount = 0
      state.unreadSocialCount = 0
    },
    
    removeExpiredNotifications: (state) => {
      const now = new Date()
      state.notifications = state.notifications.filter(n => 
        !n.expiresAt || new Date(n.expiresAt) > now
      )
    },
    
    // Count management
    updateUnreadCounts: (state) => {
      const unreadNotifications = state.notifications.filter(n => !n.isRead)
      state.unreadCount = unreadNotifications.length
      
      state.unreadGameCount = unreadNotifications.filter(n => 
        n.type.includes('game') || n.type === 'turn_ready' || n.type === 'turn_complete'
      ).length
      
      state.unreadSocialCount = unreadNotifications.filter(n => 
        n.type === 'player_joined' || n.type === 'player_left'
      ).length
    },
  },
  extraReducers: (builder) => {
    // Get notifications
    builder
      .addCase(getNotifications.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(getNotifications.fulfilled, (state, action) => {
        state.isLoading = false
        state.notifications = action.payload.items
        
        // Calculate unread counts
        const unreadNotifications = action.payload.items.filter(n => !n.isRead)
        state.unreadCount = unreadNotifications.length
        
        state.unreadGameCount = unreadNotifications.filter(n => 
          n.type.includes('game') || n.type === 'turn_ready' || n.type === 'turn_complete'
        ).length
        
        state.unreadSocialCount = unreadNotifications.filter(n => 
          n.type === 'player_joined' || n.type === 'player_left'
        ).length
        
        state.error = null
      })
      .addCase(getNotifications.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

    // Mark as read
    builder
      .addCase(markAsRead.fulfilled, (state, action) => {
        const notification = state.notifications.find(n => n.id === action.payload)
        if (notification && !notification.isRead) {
          notification.isRead = true
          state.unreadCount = Math.max(0, state.unreadCount - 1)
          
          // Update category counts
          if (notification.type.includes('game') || notification.type === 'turn_ready' || notification.type === 'turn_complete') {
            state.unreadGameCount = Math.max(0, state.unreadGameCount - 1)
          } else if (notification.type === 'player_joined' || notification.type === 'player_left') {
            state.unreadSocialCount = Math.max(0, state.unreadSocialCount - 1)
          }
        }
      })

    // Mark all as read
    builder
      .addCase(markAllAsRead.fulfilled, (state) => {
        state.notifications.forEach(notification => {
          notification.isRead = true
        })
        state.unreadCount = 0
        state.unreadGameCount = 0
        state.unreadSocialCount = 0
      })

    // Dismiss notification
    builder
      .addCase(dismissNotification.fulfilled, (state, action) => {
        const notification = state.notifications.find(n => n.id === action.payload)
        if (notification) {
          notification.isDismissed = true
        }
      })

    // Update settings
    builder
      .addCase(updateNotificationSettings.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(updateNotificationSettings.fulfilled, (state, action) => {
        state.isLoading = false
        state.settings = action.payload
        state.error = null
      })
      .addCase(updateNotificationSettings.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })
  },
})

export const {
  addRealtimeNotification,
  removeRealtimeNotification,
  clearRealtimeNotifications,
  markNotificationAsRead,
  markNotificationAsDismissed,
  updateSettingsLocal,
  clearError,
  clearAllNotifications,
  removeExpiredNotifications,
  updateUnreadCounts,
} = notificationSlice.actions

export default notificationSlice