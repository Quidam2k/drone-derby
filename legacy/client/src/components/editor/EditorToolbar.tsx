import React, { useState } from 'react'
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  Box,
  Chip,
  Divider,
  Tooltip,
} from '@mui/material'
import {
  Save,
  Add,
  Clear,
  Undo,
  Redo,
  Download,
  Upload,
  Share,
  PlayArrow,
  Info,
} from '@mui/icons-material'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { RootState } from '@/store'
import {
  createNewBoard,
  clearBoard,
  resetEditor,
  saveBoard,
  markSaved,
} from '@/store/slices/boardSlice'

interface SaveDialogProps {
  open: boolean
  onClose: () => void
  onSave: (boardData: {
    name: string
    description: string
    isPublic: boolean
  }) => void
  initialName?: string
  initialDescription?: string
  initialIsPublic?: boolean
}

const SaveDialog: React.FC<SaveDialogProps> = ({
  open,
  onClose,
  onSave,
  initialName = '',
  initialDescription = '',
  initialIsPublic = false,
}) => {
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  const [isPublic, setIsPublic] = useState(initialIsPublic)

  const handleSave = () => {
    if (name.trim()) {
      onSave({
        name: name.trim(),
        description: description.trim(),
        isPublic,
      })
      onClose()
    }
  }

  const handleClose = () => {
    setName(initialName)
    setDescription(initialDescription)
    setIsPublic(initialIsPublic)
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Save Board</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="Board Name"
          fullWidth
          variant="outlined"
          value={name}
          onChange={(e) => setName(e.target.value)}
          sx={{ mb: 2 }}
        />
        <TextField
          margin="dense"
          label="Description (optional)"
          fullWidth
          multiline
          rows={3}
          variant="outlined"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          sx={{ mb: 2 }}
        />
        <FormControlLabel
          control={
            <Switch
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
            />
          }
          label="Make board public"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button 
          onClick={handleSave} 
          variant="contained"
          disabled={!name.trim()}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  )
}

interface EditorToolbarProps {
  onTestBoard?: () => void
}

const EditorToolbar: React.FC<EditorToolbarProps> = ({ onTestBoard }) => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { editorBoard, hasUnsavedChanges, currentBoard, isLoading } = useSelector(
    (state: RootState) => state.board
  )
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)

  const handleNewBoard = () => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to create a new board?'
      )
      if (!confirmed) return
    }
    dispatch(createNewBoard())
  }

  const handleSave = async (boardData: {
    name: string
    description: string
    isPublic: boolean
  }) => {
    if (!editorBoard) return

    try {
      await dispatch(saveBoard({
        boardData: {
          ...boardData,
          tiles: editorBoard.tiles,
          checkpoints: editorBoard.checkpoints,
          startPositions: editorBoard.startPositions,
        },
        boardId: currentBoard?.id,
      })).unwrap()
      
      // Show success message (you could use a toast here)
      console.log('Board saved successfully!')
    } catch (error) {
      console.error('Failed to save board:', error)
      // Show error message (you could use a toast here)
    }
  }

  const handleClear = () => {
    const confirmed = window.confirm(
      'Are you sure you want to clear the entire board? This action cannot be undone.'
    )
    if (confirmed) {
      dispatch(clearBoard())
    }
  }

  const handleExportBoard = () => {
    if (!editorBoard) return

    const boardData = {
      name: currentBoard?.name || 'Untitled Board',
      tiles: editorBoard.tiles,
      checkpoints: editorBoard.checkpoints,
      startPositions: editorBoard.startPositions,
      exportedAt: new Date().toISOString(),
    }

    const dataStr = JSON.stringify(boardData, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr)
    
    const exportFileDefaultName = `${boardData.name.toLowerCase().replace(/\s+/g, '-')}.json`
    
    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
  }

  const handleImportBoard = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (e) => {
          try {
            const boardData = JSON.parse(e.target?.result as string)
            // TODO: Validate board data structure
            // For now, just log it
            console.log('Imported board data:', boardData)
            // You would implement board loading logic here
          } catch (error) {
            console.error('Failed to import board:', error)
            alert('Failed to import board. Please check the file format.')
          }
        }
        reader.readAsText(file)
      }
    }
    input.click()
  }

  const handleBack = () => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to leave?'
      )
      if (!confirmed) return
    }
    dispatch(resetEditor())
    navigate('/boards')
  }

  const getValidationInfo = () => {
    if (!editorBoard) return { valid: false, issues: ['No board loaded'] }

    const issues: string[] = []

    // Check for start positions
    if (editorBoard.startPositions.length === 0) {
      issues.push('At least one start position is required')
    }
    if (editorBoard.startPositions.length > 4) {
      issues.push('Maximum 4 start positions allowed')
    }

    // Check for checkpoints
    if (editorBoard.checkpoints.length > 0) {
      const checkpointIds = editorBoard.checkpoints.map(cp => cp.id).sort((a, b) => a - b)
      for (let i = 0; i < checkpointIds.length; i++) {
        if (checkpointIds[i] !== i + 1) {
          issues.push('Checkpoint numbering must be sequential starting from 1')
          break
        }
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    }
  }

  const validation = getValidationInfo()

  return (
    <>
      <AppBar position="static" sx={{ mb: 2 }}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Level Editor
            {currentBoard && (
              <Typography variant="subtitle2" component="span" sx={{ ml: 1 }}>
                - {currentBoard.name}
              </Typography>
            )}
            {hasUnsavedChanges && (
              <Chip
                label="Unsaved"
                size="small"
                color="warning"
                sx={{ ml: 1 }}
              />
            )}
          </Typography>

          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {/* Validation status */}
            <Tooltip 
              title={
                validation.valid 
                  ? 'Board is valid' 
                  : `Issues: ${validation.issues.join(', ')}`
              }
            >
              <Chip
                icon={<Info />}
                label={validation.valid ? 'Valid' : 'Issues'}
                color={validation.valid ? 'success' : 'error'}
                size="small"
              />
            </Tooltip>

            <Divider orientation="vertical" flexItem />

            {/* File operations */}
            <Tooltip title="New Board">
              <IconButton color="inherit" onClick={handleNewBoard}>
                <Add />
              </IconButton>
            </Tooltip>

            <Tooltip title="Save Board">
              <IconButton 
                color="inherit" 
                onClick={() => setSaveDialogOpen(true)}
                disabled={!editorBoard || isLoading}
              >
                <Save />
              </IconButton>
            </Tooltip>

            <Tooltip title="Export Board">
              <IconButton 
                color="inherit" 
                onClick={handleExportBoard}
                disabled={!editorBoard}
              >
                <Download />
              </IconButton>
            </Tooltip>

            <Tooltip title="Import Board">
              <IconButton color="inherit" onClick={handleImportBoard}>
                <Upload />
              </IconButton>
            </Tooltip>

            <Divider orientation="vertical" flexItem />

            {/* Edit operations */}
            <Tooltip title="Clear Board">
              <IconButton 
                color="inherit" 
                onClick={handleClear}
                disabled={!editorBoard}
              >
                <Clear />
              </IconButton>
            </Tooltip>

            <Divider orientation="vertical" flexItem />

            {/* Test and share */}
            {onTestBoard && (
              <Tooltip title="Test Board">
                <IconButton 
                  color="inherit" 
                  onClick={onTestBoard}
                  disabled={!validation.valid}
                >
                  <PlayArrow />
                </IconButton>
              </Tooltip>
            )}

            <Button 
              color="inherit" 
              onClick={handleBack}
              variant="outlined"
              sx={{ ml: 1 }}
            >
              Back to Boards
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      <SaveDialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        onSave={handleSave}
        initialName={currentBoard?.name || ''}
        initialDescription=""
        initialIsPublic={currentBoard?.isPublic || false}
      />
    </>
  )
}

export default EditorToolbar