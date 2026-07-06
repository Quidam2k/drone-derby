import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { Template, Tile } from '@/shared/types/game'
import { TemplateListItem, PaginatedResponse } from '@/shared/types/api'
import { templateService } from '@/services/templateService'

export interface TemplateState {
  // Current template for viewing/editing
  currentTemplate: Template | null
  
  // Template discovery and browsing
  publicTemplates: TemplateListItem[]
  userTemplates: TemplateListItem[]
  popularTemplates: TemplateListItem[]
  searchResults: PaginatedResponse<TemplateListItem> | null
  
  // Template categories
  categories: Array<{ category: string; count: number }>
  selectedCategory: string | null
  
  // UI state
  isLoading: boolean
  error: string | null
  
  // Pagination
  currentPage: number
  totalPages: number
  
  // Template selection (for use in editor)
  selectedTemplate: TemplateListItem | null
}

const initialState: TemplateState = {
  currentTemplate: null,
  publicTemplates: [],
  userTemplates: [],
  popularTemplates: [],
  searchResults: null,
  categories: [],
  selectedCategory: null,
  isLoading: false,
  error: null,
  currentPage: 1,
  totalPages: 1,
  selectedTemplate: null,
}

// Async thunks
export const loadTemplate = createAsyncThunk(
  'template/loadTemplate',
  async (templateId: string, { rejectWithValue }) => {
    try {
      const template = await templateService.getTemplate(templateId)
      return template
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to load template')
    }
  }
)

export const createTemplate = createAsyncThunk(
  'template/createTemplate',
  async (templateData: {
    name: string
    description?: string
    width: number
    height: number
    tiles: Tile[][]
    isPublic?: boolean
    tags?: string[]
    category?: string
  }, { rejectWithValue }) => {
    try {
      const template = await templateService.createTemplate(templateData)
      return template
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to create template')
    }
  }
)

export const updateTemplate = createAsyncThunk(
  'template/updateTemplate',
  async ({ 
    templateId, 
    templateData 
  }: { 
    templateId: string
    templateData: {
      name?: string
      description?: string
      isPublic?: boolean
      tags?: string[]
      category?: string
    }
  }, { rejectWithValue }) => {
    try {
      const template = await templateService.updateTemplate(templateId, templateData)
      return template
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to update template')
    }
  }
)

export const deleteTemplate = createAsyncThunk(
  'template/deleteTemplate',
  async (templateId: string, { rejectWithValue }) => {
    try {
      await templateService.deleteTemplate(templateId)
      return templateId
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to delete template')
    }
  }
)

export const getPublicTemplates = createAsyncThunk(
  'template/getPublicTemplates',
  async ({ page = 1, limit = 20 }: { page?: number; limit?: number }, { rejectWithValue }) => {
    try {
      const result = await templateService.getPublicTemplates({ page, limit })
      return result
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to get public templates')
    }
  }
)

export const getUserTemplates = createAsyncThunk(
  'template/getUserTemplates',
  async ({ page = 1, limit = 20 }: { page?: number; limit?: number }, { rejectWithValue }) => {
    try {
      const result = await templateService.getUserTemplates({ page, limit })
      return result
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to get user templates')
    }
  }
)

export const getPopularTemplates = createAsyncThunk(
  'template/getPopularTemplates',
  async (limit: number = 10, { rejectWithValue }) => {
    try {
      const templates = await templateService.getPopularTemplates(limit)
      return templates
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to get popular templates')
    }
  }
)

export const searchTemplates = createAsyncThunk(
  'template/searchTemplates',
  async (searchParams: {
    query?: string
    tags?: string[]
    category?: string
    isPublic?: boolean
    page?: number
    limit?: number
    sortBy?: string
    sortOrder?: 'asc' | 'desc'
  }, { rejectWithValue }) => {
    try {
      const result = await templateService.searchTemplates(searchParams)
      return result
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to search templates')
    }
  }
)

export const getTemplateCategories = createAsyncThunk(
  'template/getTemplateCategories',
  async (_, { rejectWithValue }) => {
    try {
      const categories = await templateService.getCategories()
      return categories
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to get template categories')
    }
  }
)

export const getTemplatesByCategory = createAsyncThunk(
  'template/getTemplatesByCategory',
  async ({ category, limit = 20 }: { category: string; limit?: number }, { rejectWithValue }) => {
    try {
      const templates = await templateService.getTemplatesByCategory(category, limit)
      return { category, templates }
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to get templates by category')
    }
  }
)

export const downloadTemplate = createAsyncThunk(
  'template/downloadTemplate',
  async (templateId: string, { rejectWithValue }) => {
    try {
      await templateService.downloadTemplate(templateId)
      return templateId
    } catch (error) {
      return rejectWithValue(error instanceof Error ? error.message : 'Failed to download template')
    }
  }
)

const templateSlice = createSlice({
  name: 'template',
  initialState,
  reducers: {
    // Template selection for editor
    selectTemplate: (state, action: PayloadAction<TemplateListItem | null>) => {
      state.selectedTemplate = action.payload
    },
    
    // Category filtering
    setSelectedCategory: (state, action: PayloadAction<string | null>) => {
      state.selectedCategory = action.payload
    },
    
    // Navigation and pagination
    setCurrentPage: (state, action: PayloadAction<number>) => {
      state.currentPage = action.payload
    },
    
    // Error handling
    clearError: (state) => {
      state.error = null
    },
    
    // Clear search results
    clearSearchResults: (state) => {
      state.searchResults = null
      state.currentPage = 1
    },
    
    // Update template rating locally (for optimistic updates)
    updateTemplateRating: (state, action: PayloadAction<{ templateId: string; rating: number }>) => {
      const { templateId, rating } = action.payload
      
      // Update in all relevant arrays
      const updateRating = (template: TemplateListItem) => {
        if (template.id === templateId) {
          template.rating = rating
        }
      }
      
      state.publicTemplates.forEach(updateRating)
      state.userTemplates.forEach(updateRating)
      state.popularTemplates.forEach(updateRating)
      
      if (state.searchResults) {
        state.searchResults.items.forEach(updateRating)
      }
    },
    
    // Update download count locally
    incrementDownloadCount: (state, action: PayloadAction<string>) => {
      const templateId = action.payload
      
      const updateDownloads = (template: TemplateListItem) => {
        if (template.id === templateId) {
          template.downloads += 1
        }
      }
      
      state.publicTemplates.forEach(updateDownloads)
      state.userTemplates.forEach(updateDownloads)
      state.popularTemplates.forEach(updateDownloads)
      
      if (state.searchResults) {
        state.searchResults.items.forEach(updateDownloads)
      }
    },
  },
  extraReducers: (builder) => {
    // Load template
    builder
      .addCase(loadTemplate.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(loadTemplate.fulfilled, (state, action) => {
        state.isLoading = false
        state.currentTemplate = action.payload
        state.error = null
      })
      .addCase(loadTemplate.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

    // Create template
    builder
      .addCase(createTemplate.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(createTemplate.fulfilled, (state, action) => {
        state.isLoading = false
        state.userTemplates.unshift(action.payload as unknown as TemplateListItem)
        state.error = null
      })
      .addCase(createTemplate.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

    // Update template
    builder
      .addCase(updateTemplate.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(updateTemplate.fulfilled, (state, action) => {
        state.isLoading = false
        if (state.currentTemplate && state.currentTemplate.id === action.payload.id) {
          state.currentTemplate = action.payload
        }
        // Update in user templates list
        const index = state.userTemplates.findIndex(t => t.id === action.payload.id)
        if (index !== -1) {
          state.userTemplates[index] = action.payload as unknown as TemplateListItem
        }
        state.error = null
      })
      .addCase(updateTemplate.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

    // Delete template
    builder
      .addCase(deleteTemplate.pending, (state) => {
        state.isLoading = true
        state.error = null
      })
      .addCase(deleteTemplate.fulfilled, (state, action) => {
        state.isLoading = false
        // Remove from user templates list
        state.userTemplates = state.userTemplates.filter(template => template.id !== action.payload)
        state.error = null
      })
      .addCase(deleteTemplate.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

    // Get public templates
    builder
      .addCase(getPublicTemplates.pending, (state) => {
        state.isLoading = true
      })
      .addCase(getPublicTemplates.fulfilled, (state, action) => {
        state.isLoading = false
        state.publicTemplates = action.payload.items
        state.totalPages = action.payload.totalPages
        state.error = null
      })
      .addCase(getPublicTemplates.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

    // Get user templates
    builder
      .addCase(getUserTemplates.pending, (state) => {
        state.isLoading = true
      })
      .addCase(getUserTemplates.fulfilled, (state, action) => {
        state.isLoading = false
        state.userTemplates = action.payload.items
        state.totalPages = action.payload.totalPages
        state.error = null
      })
      .addCase(getUserTemplates.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

    // Get popular templates
    builder
      .addCase(getPopularTemplates.pending, (state) => {
        state.isLoading = true
      })
      .addCase(getPopularTemplates.fulfilled, (state, action) => {
        state.isLoading = false
        state.popularTemplates = action.payload
        state.error = null
      })
      .addCase(getPopularTemplates.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

    // Search templates
    builder
      .addCase(searchTemplates.pending, (state) => {
        state.isLoading = true
      })
      .addCase(searchTemplates.fulfilled, (state, action) => {
        state.isLoading = false
        state.searchResults = action.payload
        state.currentPage = action.payload.page
        state.totalPages = action.payload.totalPages
        state.error = null
      })
      .addCase(searchTemplates.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

    // Get template categories
    builder
      .addCase(getTemplateCategories.pending, (state) => {
        state.isLoading = true
      })
      .addCase(getTemplateCategories.fulfilled, (state, action) => {
        state.isLoading = false
        state.categories = action.payload
        state.error = null
      })
      .addCase(getTemplateCategories.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

    // Get templates by category
    builder
      .addCase(getTemplatesByCategory.pending, (state) => {
        state.isLoading = true
      })
      .addCase(getTemplatesByCategory.fulfilled, (state, action) => {
        state.isLoading = false
        // This could update a category-specific list if needed
        state.error = null
      })
      .addCase(getTemplatesByCategory.rejected, (state, action) => {
        state.isLoading = false
        state.error = action.payload as string
      })

    // Download template
    builder
      .addCase(downloadTemplate.fulfilled, (state, action) => {
        // Increment download count
        const templateId = action.payload
        const updateDownloads = (template: TemplateListItem) => {
          if (template.id === templateId) {
            template.downloads += 1
          }
        }
        
        state.publicTemplates.forEach(updateDownloads)
        state.popularTemplates.forEach(updateDownloads)
        
        if (state.searchResults) {
          state.searchResults.items.forEach(updateDownloads)
        }
      })
  },
})

export const {
  selectTemplate,
  setSelectedCategory,
  setCurrentPage,
  clearError,
  clearSearchResults,
  updateTemplateRating,
  incrementDownloadCount,
} = templateSlice.actions

export default templateSlice