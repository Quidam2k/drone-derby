import { Template, Tile } from '@/shared/types/game'
import { 
  TemplateListItem, 
  PaginatedResponse, 
  ApiResponse,
  CreateTemplateRequest,
  SearchTemplatesRequest
} from '@/shared/types/api'
import { apiClient } from './api'

export class TemplateService {
  async getTemplate(templateId: string): Promise<Template> {
    const response = await apiClient.get<ApiResponse<Template>>(`/templates/${templateId}`)
    
    if (response.success && response.data) {
      return response.data
    }
    
    throw new Error(response.error || 'Failed to get template')
  }
  
  async createTemplate(templateData: {
    name: string
    description?: string
    width: number
    height: number
    tiles: Tile[][]
    isPublic?: boolean
    tags?: string[]
    category?: string
  }): Promise<Template> {
    const response = await apiClient.post<ApiResponse<Template>>('/templates', templateData)
    
    if (response.success && response.data) {
      return response.data
    }
    
    throw new Error(response.error || 'Failed to create template')
  }
  
  async updateTemplate(templateId: string, templateData: {
    name?: string
    description?: string
    isPublic?: boolean
    tags?: string[]
    category?: string
  }): Promise<Template> {
    const response = await apiClient.put<ApiResponse<Template>>(
      `/templates/${templateId}`, 
      templateData
    )
    
    if (response.success && response.data) {
      return response.data
    }
    
    throw new Error(response.error || 'Failed to update template')
  }
  
  async deleteTemplate(templateId: string): Promise<void> {
    const response = await apiClient.delete<ApiResponse<void>>(`/templates/${templateId}`)
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to delete template')
    }
  }
  
  async getPublicTemplates(options: {
    page?: number
    limit?: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  } = {}): Promise<PaginatedResponse<TemplateListItem>> {
    const params = new URLSearchParams()
    
    if (options.page) params.append('page', options.page.toString())
    if (options.limit) params.append('limit', options.limit.toString())
    if (options.sortBy) params.append('sortBy', options.sortBy)
    if (options.sortOrder) params.append('sortOrder', options.sortOrder)
    
    const response = await apiClient.get<ApiResponse<PaginatedResponse<TemplateListItem>>>(
      `/templates/public?${params.toString()}`
    )
    
    if (response.success && response.data) {
      return response.data
    }
    
    throw new Error(response.error || 'Failed to get public templates')
  }
  
  async getUserTemplates(options: {
    page?: number
    limit?: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  } = {}): Promise<PaginatedResponse<TemplateListItem>> {
    const params = new URLSearchParams()
    
    if (options.page) params.append('page', options.page.toString())
    if (options.limit) params.append('limit', options.limit.toString())
    if (options.sortBy) params.append('sortBy', options.sortBy)
    if (options.sortOrder) params.append('sortOrder', options.sortOrder)
    
    const response = await apiClient.get<ApiResponse<PaginatedResponse<TemplateListItem>>>(
      `/templates/user?${params.toString()}`
    )
    
    if (response.success && response.data) {
      return response.data
    }
    
    throw new Error(response.error || 'Failed to get user templates')
  }
  
  async getPopularTemplates(limit: number = 10): Promise<TemplateListItem[]> {
    const response = await apiClient.get<ApiResponse<TemplateListItem[]>>(
      `/templates/popular?limit=${limit}`
    )
    
    if (response.success && response.data) {
      return response.data
    }
    
    throw new Error(response.error || 'Failed to get popular templates')
  }
  
  async searchTemplates(searchParams: {
    query?: string
    tags?: string[]
    category?: string
    isPublic?: boolean
    page?: number
    limit?: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  }): Promise<PaginatedResponse<TemplateListItem>> {
    const params = new URLSearchParams()
    
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          value.forEach(v => params.append(key, v.toString()))
        } else {
          params.append(key, value.toString())
        }
      }
    })
    
    const response = await apiClient.get<ApiResponse<PaginatedResponse<TemplateListItem>>>(
      `/templates/search?${params.toString()}`
    )
    
    if (response.success && response.data) {
      return response.data
    }
    
    throw new Error(response.error || 'Failed to search templates')
  }
  
  async getCategories(): Promise<Array<{ category: string; count: number }>> {
    const response = await apiClient.get<ApiResponse<Array<{ category: string; count: number }>>>(
      '/templates/categories'
    )
    
    if (response.success && response.data) {
      return response.data
    }
    
    throw new Error(response.error || 'Failed to get template categories')
  }
  
  async getTemplatesByCategory(category: string, limit: number = 20): Promise<TemplateListItem[]> {
    const response = await apiClient.get<ApiResponse<TemplateListItem[]>>(
      `/templates/category/${category}?limit=${limit}`
    )
    
    if (response.success && response.data) {
      return response.data
    }
    
    throw new Error(response.error || 'Failed to get templates by category')
  }
  
  async downloadTemplate(templateId: string): Promise<void> {
    const response = await apiClient.post<ApiResponse<void>>(`/templates/${templateId}/download`)
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to download template')
    }
  }
  
  async rateTemplate(templateId: string, rating: number): Promise<void> {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5')
    }
    
    const response = await apiClient.post<ApiResponse<void>>(
      `/templates/${templateId}/rate`,
      { rating }
    )
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to rate template')
    }
  }
  
  async generatePreview(tiles: Tile[][], width: number, height: number): Promise<string> {
    const response = await apiClient.post<ApiResponse<{ previewImage: string }>>(
      '/templates/preview',
      { tiles, width, height }
    )
    
    if (response.success && response.data) {
      return response.data.previewImage
    }
    
    throw new Error(response.error || 'Failed to generate preview')
  }
  
  async exportTemplate(templateId: string, format: 'json' | 'png'): Promise<Blob> {
    const response = await apiClient.get(`/templates/${templateId}/export?format=${format}`, {
      responseType: 'blob'
    })
    
    return new Blob([response])
  }
  
  async importTemplate(file: File): Promise<Template> {
    const formData = new FormData()
    formData.append('template', file)
    
    const response = await apiClient.post<ApiResponse<Template>>('/templates/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    
    if (response.success && response.data) {
      return response.data
    }
    
    throw new Error(response.error || 'Failed to import template')
  }
  
  async getFeaturedTemplates(): Promise<TemplateListItem[]> {
    const response = await apiClient.get<ApiResponse<TemplateListItem[]>>('/templates/featured')
    
    if (response.success && response.data) {
      return response.data
    }
    
    throw new Error(response.error || 'Failed to get featured templates')
  }
  
  async getRecentTemplates(limit: number = 10): Promise<TemplateListItem[]> {
    const response = await apiClient.get<ApiResponse<TemplateListItem[]>>(
      `/templates/recent?limit=${limit}`
    )
    
    if (response.success && response.data) {
      return response.data
    }
    
    throw new Error(response.error || 'Failed to get recent templates')
  }
  
  async getTemplateStats(templateId: string): Promise<{
    downloads: number
    rating: number
    ratingCount: number
    usageInBoards: number
  }> {
    const response = await apiClient.get<ApiResponse<{
      downloads: number
      rating: number
      ratingCount: number
      usageInBoards: number
    }>>(`/templates/${templateId}/stats`)
    
    if (response.success && response.data) {
      return response.data
    }
    
    throw new Error(response.error || 'Failed to get template stats')
  }
}

export const templateService = new TemplateService()