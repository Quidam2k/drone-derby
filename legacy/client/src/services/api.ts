import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { store } from '@/store'
import { logout, refreshToken } from '@/store/slices/authSlice'
import { addNotification } from '@/store/slices/uiSlice'

// API configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const state = store.getState()
    const token = state.auth.tokens?.accessToken
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor for error handling and token refresh
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response
  },
  async (error) => {
    const originalRequest = error.config
    
    // Handle 401 errors (unauthorized)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      
      const state = store.getState()
      const refreshTokenValue = state.auth.tokens?.refreshToken
      
      if (refreshTokenValue) {
        try {
          // Attempt to refresh the token
          await store.dispatch(refreshToken())
          
          // Retry the original request with new token
          const newState = store.getState()
          const newToken = newState.auth.tokens?.accessToken
          
          if (newToken) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`
            return api(originalRequest)
          }
        } catch (refreshError) {
          // Refresh failed, logout user
          store.dispatch(logout())
          store.dispatch(addNotification({
            type: 'error',
            title: 'Session Expired',
            message: 'Please log in again to continue.',
          }))
          return Promise.reject(refreshError)
        }
      } else {
        // No refresh token, logout user
        store.dispatch(logout())
        return Promise.reject(error)
      }
    }
    
    // Handle other HTTP errors
    if (error.response) {
      const { status, data } = error.response
      
      // Show user-friendly error messages
      let errorMessage = 'An unexpected error occurred'
      
      if (data?.error) {
        errorMessage = data.error
      } else if (data?.message) {
        errorMessage = data.message
      } else {
        switch (status) {
          case 400:
            errorMessage = 'Invalid request. Please check your input.'
            break
          case 403:
            errorMessage = 'You do not have permission to perform this action.'
            break
          case 404:
            errorMessage = 'The requested resource was not found.'
            break
          case 429:
            errorMessage = 'Too many requests. Please try again later.'
            break
          case 500:
            errorMessage = 'Server error. Please try again later.'
            break
          case 503:
            errorMessage = 'Service temporarily unavailable. Please try again later.'
            break
        }
      }
      
      // Show error notification for non-401 errors
      if (status !== 401) {
        store.dispatch(addNotification({
          type: 'error',
          title: `Error ${status}`,
          message: errorMessage,
        }))
      }
      
      // Create a more detailed error object
      const enhancedError = new Error(errorMessage)
      enhancedError.name = 'APIError'
      ;(enhancedError as any).status = status
      ;(enhancedError as any).data = data
      
      return Promise.reject(enhancedError)
    }
    
    // Handle network errors
    if (error.code === 'ECONNABORTED') {
      store.dispatch(addNotification({
        type: 'error',
        title: 'Request Timeout',
        message: 'The request took too long to complete. Please try again.',
      }))
    } else if (error.code === 'ERR_NETWORK') {
      store.dispatch(addNotification({
        type: 'error',
        title: 'Network Error',
        message: 'Unable to connect to the server. Please check your internet connection.',
      }))
    }
    
    return Promise.reject(error)
  }
)

// API wrapper functions
export const apiClient = {
  get: <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> =>
    api.get(url, config).then(response => response.data),
    
  post: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> =>
    api.post(url, data, config).then(response => response.data),
    
  put: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> =>
    api.put(url, data, config).then(response => response.data),
    
  patch: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> =>
    api.patch(url, data, config).then(response => response.data),
    
  delete: <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> =>
    api.delete(url, config).then(response => response.data),
}

// Upload helper for file uploads
export const uploadFile = async (
  url: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<any> => {
  const formData = new FormData()
  formData.append('file', file)
  
  return api.post(url, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
        onProgress(progress)
      }
    },
  }).then(response => response.data)
}

// Download helper for file downloads
export const downloadFile = async (url: string, filename?: string): Promise<void> => {
  const response = await api.get(url, { responseType: 'blob' })
  
  const blob = new Blob([response.data])
  const downloadUrl = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  
  link.href = downloadUrl
  link.download = filename || 'download'
  document.body.appendChild(link)
  link.click()
  
  document.body.removeChild(link)
  window.URL.revokeObjectURL(downloadUrl)
}

// Health check utility
export const checkAPIHealth = async (): Promise<boolean> => {
  try {
    await apiClient.get('/health')
    return true
  } catch (error) {
    return false
  }
}

export default api