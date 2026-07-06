import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface UIState {
  // Theme and display preferences
  theme: 'light' | 'dark' | 'system'
  sidebarOpen: boolean
  sidebarWidth: number
  
  // Level editor UI state
  editor: {
    selectedTool: 'place' | 'paint' | 'select' | 'delete' | 'rotate'
    selectedTileType: 'floor' | 'wall' | 'conveyorNormal' | 'conveyorFast' | 'checkpoint' | 'start'
    selectedDirection?: 'north' | 'south' | 'east' | 'west'
    brushSize: number
    showGrid: boolean
    showCoordinates: boolean
    snapToGrid: boolean
    zoomLevel: number
    templatesPanelOpen: boolean
    propertiesPanelOpen: boolean
    selectedArea?: {
      startX: number
      startY: number
      endX: number
      endY: number
    }
  }
  
  // Game UI state
  game: {
    showPlayerList: boolean
    showTurnHistory: boolean
    showCardDetails: boolean
    animationSpeed: number
    soundEnabled: boolean
    notificationsEnabled: boolean
  }
  
  // Modal and dialog states
  modals: {
    saveBoard: boolean
    loadBoard: boolean
    saveTemplate: boolean
    gameSettings: boolean
    userProfile: boolean
    about: boolean
  }
  
  // Loading states for different UI sections
  loading: {
    sidebar: boolean
    board: boolean
    templates: boolean
    game: boolean
  }
  
  // Mobile and responsive states
  mobile: {
    isMobile: boolean
    orientation: 'portrait' | 'landscape'
    keyboardVisible: boolean
  }
  
  // Accessibility preferences
  accessibility: {
    reducedMotion: boolean
    highContrast: boolean
    fontSize: 'small' | 'medium' | 'large'
  }
  
  // Error and notification display
  notifications: Array<{
    id: string
    type: 'info' | 'success' | 'warning' | 'error'
    title: string
    message: string
    timestamp: number
    duration?: number
    actions?: Array<{
      label: string
      action: string
    }>
  }>
}

const initialState: UIState = {
  theme: 'system',
  sidebarOpen: true,
  sidebarWidth: 280,
  
  editor: {
    selectedTool: 'place',
    selectedTileType: 'floor',
    brushSize: 1,
    showGrid: true,
    showCoordinates: true,
    snapToGrid: true,
    zoomLevel: 1,
    templatesPanelOpen: true,
    propertiesPanelOpen: true,
  },
  
  game: {
    showPlayerList: true,
    showTurnHistory: false,
    showCardDetails: true,
    animationSpeed: 1,
    soundEnabled: true,
    notificationsEnabled: true,
  },
  
  modals: {
    saveBoard: false,
    loadBoard: false,
    saveTemplate: false,
    gameSettings: false,
    userProfile: false,
    about: false,
  },
  
  loading: {
    sidebar: false,
    board: false,
    templates: false,
    game: false,
  },
  
  mobile: {
    isMobile: false,
    orientation: 'landscape',
    keyboardVisible: false,
  },
  
  accessibility: {
    reducedMotion: false,
    highContrast: false,
    fontSize: 'medium',
  },
  
  notifications: [],
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    // Theme and layout
    setTheme: (state, action: PayloadAction<'light' | 'dark' | 'system'>) => {
      state.theme = action.payload
    },
    
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen
    },
    
    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebarOpen = action.payload
    },
    
    setSidebarWidth: (state, action: PayloadAction<number>) => {
      state.sidebarWidth = Math.max(200, Math.min(400, action.payload))
    },
    
    // Editor tools and settings
    setSelectedTool: (state, action: PayloadAction<UIState['editor']['selectedTool']>) => {
      state.editor.selectedTool = action.payload
    },
    
    setSelectedTileType: (state, action: PayloadAction<UIState['editor']['selectedTileType']>) => {
      state.editor.selectedTileType = action.payload
    },
    
    setSelectedDirection: (state, action: PayloadAction<UIState['editor']['selectedDirection']>) => {
      state.editor.selectedDirection = action.payload
    },
    
    setBrushSize: (state, action: PayloadAction<number>) => {
      state.editor.brushSize = Math.max(1, Math.min(5, action.payload))
    },
    
    toggleGrid: (state) => {
      state.editor.showGrid = !state.editor.showGrid
    },
    
    toggleCoordinates: (state) => {
      state.editor.showCoordinates = !state.editor.showCoordinates
    },
    
    toggleSnapToGrid: (state) => {
      state.editor.snapToGrid = !state.editor.snapToGrid
    },
    
    setZoomLevel: (state, action: PayloadAction<number>) => {
      state.editor.zoomLevel = Math.max(0.5, Math.min(3, action.payload))
    },
    
    toggleTemplatesPanel: (state) => {
      state.editor.templatesPanelOpen = !state.editor.templatesPanelOpen
    },
    
    togglePropertiesPanel: (state) => {
      state.editor.propertiesPanelOpen = !state.editor.propertiesPanelOpen
    },
    
    setSelectedArea: (state, action: PayloadAction<UIState['editor']['selectedArea']>) => {
      state.editor.selectedArea = action.payload
    },
    
    clearSelectedArea: (state) => {
      state.editor.selectedArea = undefined
    },
    
    // Game UI settings
    togglePlayerList: (state) => {
      state.game.showPlayerList = !state.game.showPlayerList
    },
    
    toggleTurnHistory: (state) => {
      state.game.showTurnHistory = !state.game.showTurnHistory
    },
    
    toggleCardDetails: (state) => {
      state.game.showCardDetails = !state.game.showCardDetails
    },
    
    setAnimationSpeed: (state, action: PayloadAction<number>) => {
      state.game.animationSpeed = Math.max(0.5, Math.min(2, action.payload))
    },
    
    toggleSound: (state) => {
      state.game.soundEnabled = !state.game.soundEnabled
    },
    
    toggleNotifications: (state) => {
      state.game.notificationsEnabled = !state.game.notificationsEnabled
    },
    
    // Modal management
    openModal: (state, action: PayloadAction<keyof UIState['modals']>) => {
      state.modals[action.payload] = true
    },
    
    closeModal: (state, action: PayloadAction<keyof UIState['modals']>) => {
      state.modals[action.payload] = false
    },
    
    closeAllModals: (state) => {
      Object.keys(state.modals).forEach(key => {
        state.modals[key as keyof UIState['modals']] = false
      })
    },
    
    // Loading states
    setLoading: (state, action: PayloadAction<{ section: keyof UIState['loading']; loading: boolean }>) => {
      const { section, loading } = action.payload
      state.loading[section] = loading
    },
    
    // Mobile and responsive
    setMobileState: (state, action: PayloadAction<{
      isMobile?: boolean
      orientation?: 'portrait' | 'landscape'
      keyboardVisible?: boolean
    }>) => {
      Object.assign(state.mobile, action.payload)
    },
    
    // Accessibility
    setAccessibilityOption: (state, action: PayloadAction<{
      option: keyof UIState['accessibility']
      value: boolean | string
    }>) => {
      const { option, value } = action.payload
      state.accessibility[option] = value as never
    },
    
    // Notifications
    addNotification: (state, action: PayloadAction<Omit<UIState['notifications'][0], 'id' | 'timestamp'>>) => {
      const notification = {
        ...action.payload,
        id: Date.now().toString(),
        timestamp: Date.now(),
      }
      state.notifications.push(notification)
      
      // Limit to 10 notifications
      if (state.notifications.length > 10) {
        state.notifications = state.notifications.slice(-10)
      }
    },
    
    removeNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter(n => n.id !== action.payload)
    },
    
    clearNotifications: (state) => {
      state.notifications = []
    },
    
    // Bulk settings update
    updateEditorSettings: (state, action: PayloadAction<Partial<UIState['editor']>>) => {
      Object.assign(state.editor, action.payload)
    },
    
    updateGameSettings: (state, action: PayloadAction<Partial<UIState['game']>>) => {
      Object.assign(state.game, action.payload)
    },
    
    // Reset to defaults
    resetEditorSettings: (state) => {
      state.editor = initialState.editor
    },
    
    resetGameSettings: (state) => {
      state.game = initialState.game
    },
    
    resetAllSettings: () => {
      return initialState
    },
  },
})

export const {
  setTheme,
  toggleSidebar,
  setSidebarOpen,
  setSidebarWidth,
  setSelectedTool,
  setSelectedTileType,
  setSelectedDirection,
  setBrushSize,
  toggleGrid,
  toggleCoordinates,
  toggleSnapToGrid,
  setZoomLevel,
  toggleTemplatesPanel,
  togglePropertiesPanel,
  setSelectedArea,
  clearSelectedArea,
  togglePlayerList,
  toggleTurnHistory,
  toggleCardDetails,
  setAnimationSpeed,
  toggleSound,
  toggleNotifications,
  openModal,
  closeModal,
  closeAllModals,
  setLoading,
  setMobileState,
  setAccessibilityOption,
  addNotification,
  removeNotification,
  clearNotifications,
  updateEditorSettings,
  updateGameSettings,
  resetEditorSettings,
  resetGameSettings,
  resetAllSettings,
} = uiSlice.actions

export default uiSlice