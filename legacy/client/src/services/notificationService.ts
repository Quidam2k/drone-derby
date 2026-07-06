import { 
  ApiResponse,
  PaginatedResponse
} from '@/shared/types/api'
import { apiClient } from './api'

export interface NotificationData {
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
}

export interface NotificationSettings {
  emailEnabled: boolean
  pushEnabled: boolean
  gameNotifications: boolean
  socialNotifications: boolean
  systemNotifications: boolean
  soundEnabled: boolean
}

export class NotificationService {
  async getNotifications(options: {
    page?: number
    limit?: number
    type?: string
    isRead?: boolean
  } = {}): Promise<PaginatedResponse<NotificationData>> {
    const params = new URLSearchParams()
    
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString())
      }
    })
    
    const response = await apiClient.get<ApiResponse<PaginatedResponse<NotificationData>>>(
      `/notifications?${params.toString()}`
    )
    
    if (response.success && response.data) {
      return response.data
    }
    
    throw new Error(response.error || 'Failed to get notifications')
  }
  
  async markAsRead(notificationId: string): Promise<void> {
    const response = await apiClient.patch<ApiResponse<void>>(
      `/notifications/${notificationId}/read`
    )
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to mark notification as read')
    }
  }
  
  async markAllAsRead(): Promise<void> {
    const response = await apiClient.patch<ApiResponse<void>>('/notifications/read-all')
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to mark all notifications as read')
    }
  }
  
  async dismissNotification(notificationId: string): Promise<void> {
    const response = await apiClient.patch<ApiResponse<void>>(
      `/notifications/${notificationId}/dismiss`
    )
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to dismiss notification')
    }
  }
  
  async deleteNotification(notificationId: string): Promise<void> {
    const response = await apiClient.delete<ApiResponse<void>>(
      `/notifications/${notificationId}`
    )
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to delete notification')
    }
  }
  
  async getUnreadCount(): Promise<{
    total: number
    game: number
    social: number
    system: number
  }> {
    const response = await apiClient.get<ApiResponse<{
      total: number
      game: number
      social: number
      system: number
    }>>('/notifications/unread-count')
    
    if (response.success && response.data) {
      return response.data
    }
    
    throw new Error(response.error || 'Failed to get unread count')
  }
  
  async getSettings(): Promise<NotificationSettings> {
    const response = await apiClient.get<ApiResponse<NotificationSettings>>(
      '/notifications/settings'
    )
    
    if (response.success && response.data) {
      return response.data
    }
    
    throw new Error(response.error || 'Failed to get notification settings')
  }
  
  async updateSettings(settings: Partial<NotificationSettings>): Promise<NotificationSettings> {
    const response = await apiClient.put<ApiResponse<NotificationSettings>>(
      '/notifications/settings',
      settings
    )
    
    if (response.success && response.data) {
      return response.data
    }
    
    throw new Error(response.error || 'Failed to update notification settings')
  }
  
  async testNotification(type: NotificationData['type']): Promise<void> {
    const response = await apiClient.post<ApiResponse<void>>(
      '/notifications/test',
      { type }
    )
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to send test notification')
    }
  }
  
  // Browser push notification utilities
  async requestPushPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      throw new Error('Browser does not support notifications')
    }
    
    if (Notification.permission === 'granted') {
      return true
    }
    
    if (Notification.permission === 'denied') {
      return false
    }
    
    const permission = await Notification.requestPermission()
    return permission === 'granted'
  }
  
  async subscribeToPush(): Promise<void> {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      throw new Error('Push notifications not supported')
    }
    
    const hasPermission = await this.requestPushPermission()
    if (!hasPermission) {
      throw new Error('Push notification permission denied')
    }
    
    const registration = await navigator.serviceWorker.register('/sw.js')
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: this.urlBase64ToUint8Array(
        process.env.REACT_APP_VAPID_PUBLIC_KEY || ''
      )
    })
    
    // Send subscription to server
    await apiClient.post('/notifications/push-subscription', {
      subscription: subscription.toJSON()
    })
  }
  
  async unsubscribeFromPush(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      return
    }
    
    const registration = await navigator.serviceWorker.getRegistration()
    if (!registration) {
      return
    }
    
    const subscription = await registration.pushManager.getSubscription()
    if (!subscription) {
      return
    }
    
    await subscription.unsubscribe()
    
    // Remove subscription from server
    await apiClient.delete('/notifications/push-subscription')
  }
  
  // Show browser notification
  showBrowserNotification(title: string, options: {
    body?: string
    icon?: string
    badge?: string
    image?: string
    tag?: string
    data?: unknown
    actions?: Array<{
      action: string
      title: string
      icon?: string
    }>
  } = {}): Notification | null {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return null
    }
    
    return new Notification(title, {
      ...options,
      icon: options.icon || '/favicon.ico',
      badge: options.badge || '/badge.png',
    })
  }
  
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/')
    
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    
    return outputArray
  }
}

export const notificationService = new NotificationService()