import React, { useState, useEffect } from 'react'
import { Box, Grid, Paper, Tabs, Tab, Typography, Button } from '@mui/material'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { useDispatch, useSelector } from 'react-redux'
import { useParams, useNavigate } from 'react-router-dom'
import { RootState } from '@/store'
import { createNewBoard, loadBoard } from '@/store/slices/boardSlice'
import { Tile } from '@/shared/types/game'

// Editor components
import EditorToolbar from '@/components/editor/EditorToolbar'
import BoardCanvas from '@/components/editor/BoardCanvas'
import TilePalette from '@/components/editor/TilePalette'
import PropertiesPanel from '@/components/editor/PropertiesPanel'
import ValidationPanel from '@/components/editor/ValidationPanel'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      style={{ height: '100%' }}
    >
      {value === index && children}
    </div>
  )
}

const LevelEditorPage: React.FC = () => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { boardId } = useParams<{ boardId?: string }>()
  const { editorBoard, isLoading, error } = useSelector((state: RootState) => state.board)
  
  const [selectedTile, setSelectedTile] = useState<{
    x: number
    y: number
    tile: Tile
  } | undefined>()
  const [rightPanelTab, setRightPanelTab] = useState(0)

  useEffect(() => {
    if (boardId) {
      // Load existing board
      dispatch(loadBoard(boardId))
    } else {
      // Create new board
      dispatch(createNewBoard())
    }
  }, [dispatch, boardId])

  const handleTileSelect = (x: number, y: number, tile: Tile) => {
    setSelectedTile({ x, y, tile })
    setRightPanelTab(0) // Switch to properties tab
  }

  const handleTileDeselect = () => {
    setSelectedTile(undefined)
  }

  const handleTestBoard = () => {
    // TODO: Implement board testing functionality
    // This could create a test game or open a preview mode
    console.log('Testing board...')
  }

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setRightPanelTab(newValue)
  }

  if (isLoading) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        minHeight="60vh"
      >
        <LoadingSpinner />
      </Box>
    )
  }

  if (error) {
    return (
      <Box p={4}>
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h6" color="error" gutterBottom>
            Error Loading Editor
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {error}
          </Typography>
          <Button 
            variant="contained" 
            onClick={() => navigate('/boards')} 
            sx={{ mt: 2 }}
          >
            Back to Boards
          </Button>
        </Paper>
      </Box>
    )
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Toolbar */}
        <EditorToolbar onTestBoard={handleTestBoard} />

        {/* Main editor layout */}
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          <Grid container sx={{ height: '100%' }}>
            {/* Left panel - Tile Palette */}
            <Grid item xs={12} md={2} sx={{ height: '100%' }}>
              <Box sx={{ height: '100%', p: 1 }}>
                <TilePalette />
              </Box>
            </Grid>

            {/* Center panel - Board Canvas */}
            <Grid item xs={12} md={7} sx={{ height: '100%' }}>
              <Box 
                sx={{ 
                  height: '100%', 
                  p: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <BoardCanvas onTileSelect={handleTileSelect} />
              </Box>
            </Grid>

            {/* Right panel - Properties and Validation */}
            <Grid item xs={12} md={3} sx={{ height: '100%' }}>
              <Box sx={{ height: '100%', p: 1, display: 'flex', flexDirection: 'column' }}>
                {/* Tab headers */}
                <Paper sx={{ mb: 1 }}>
                  <Tabs
                    value={rightPanelTab}
                    onChange={handleTabChange}
                    variant="fullWidth"
                  >
                    <Tab label="Properties" />
                    <Tab label="Validation" />
                  </Tabs>
                </Paper>

                {/* Tab content */}
                <Box sx={{ flex: 1, overflow: 'hidden' }}>
                  <TabPanel value={rightPanelTab} index={0}>
                    <PropertiesPanel
                      selectedTile={selectedTile}
                      onTileDeselect={handleTileDeselect}
                    />
                  </TabPanel>
                  <TabPanel value={rightPanelTab} index={1}>
                    <ValidationPanel />
                  </TabPanel>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Box>
    </DndProvider>
  )
}

export default LevelEditorPage