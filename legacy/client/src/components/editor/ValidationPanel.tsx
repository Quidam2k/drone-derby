import React from 'react'
import {
  Paper,
  Typography,
  Box,
  Alert,
  AlertTitle,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  LinearProgress,
} from '@mui/material'
import {
  CheckCircle,
  Error,
  Warning,
  Info,
  Flag,
  Home,
  Route,
} from '@mui/icons-material'
import { useSelector } from 'react-redux'
import { RootState } from '@/store'

type ValidationIssue = {
  type: 'error' | 'warning' | 'info'
  message: string
  position?: { x: number; y: number }
  category: 'gameplay' | 'design' | 'performance'
}

const ValidationPanel: React.FC = () => {
  const { editorBoard } = useSelector((state: RootState) => state.board)

  const validateBoard = (): ValidationIssue[] => {
    if (!editorBoard) return []

    const issues: ValidationIssue[] = []

    // Check start positions
    if (editorBoard.startPositions.length === 0) {
      issues.push({
        type: 'error',
        message: 'At least one start position is required',
        category: 'gameplay',
      })
    }

    if (editorBoard.startPositions.length > 4) {
      issues.push({
        type: 'error',
        message: 'Maximum 4 start positions allowed',
        category: 'gameplay',
      })
    }

    if (editorBoard.startPositions.length === 1) {
      issues.push({
        type: 'warning',
        message: 'Only one start position - consider adding more for multiplayer',
        category: 'design',
      })
    }

    // Check for duplicate start positions
    const startPositionSet = new Set()
    editorBoard.startPositions.forEach(pos => {
      const key = `${pos.x},${pos.y}`
      if (startPositionSet.has(key)) {
        issues.push({
          type: 'error',
          message: `Duplicate start position at (${pos.x}, ${pos.y})`,
          position: pos,
          category: 'gameplay',
        })
      }
      startPositionSet.add(key)
    })

    // Check checkpoints
    if (editorBoard.checkpoints.length > 0) {
      const checkpointIds = editorBoard.checkpoints.map(cp => cp.id).sort((a, b) => a - b)
      
      // Check sequential numbering starting from 1
      for (let i = 0; i < checkpointIds.length; i++) {
        if (checkpointIds[i] !== i + 1) {
          issues.push({
            type: 'error',
            message: 'Checkpoint numbering must be sequential starting from 1',
            category: 'gameplay',
          })
          break
        }
      }

      // Check for duplicate checkpoint positions
      const checkpointPositionSet = new Set()
      editorBoard.checkpoints.forEach(cp => {
        const key = `${cp.position.x},${cp.position.y}`
        if (checkpointPositionSet.has(key)) {
          issues.push({
            type: 'error',
            message: `Duplicate checkpoint at (${cp.position.x}, ${cp.position.y})`,
            position: cp.position,
            category: 'gameplay',
          })
        }
        checkpointPositionSet.add(key)
      })
    }

    // Check for isolated areas (basic connectivity check)
    const floorTiles = new Set<string>()
    const walls = new Set<string>()
    
    editorBoard.tiles.forEach((row, y) => {
      row.forEach((tile, x) => {
        const key = `${x},${y}`
        if (tile.type === 'wall') {
          walls.add(key)
        } else {
          floorTiles.add(key)
        }
      })
    })

    // Check if start positions are accessible
    editorBoard.startPositions.forEach(pos => {
      const key = `${pos.x},${pos.y}`
      if (walls.has(key)) {
        issues.push({
          type: 'error',
          message: `Start position at (${pos.x}, ${pos.y}) is blocked by a wall`,
          position: pos,
          category: 'gameplay',
        })
      }
    })

    // Check if checkpoints are accessible
    editorBoard.checkpoints.forEach(cp => {
      const key = `${cp.position.x},${cp.position.y}`
      if (walls.has(key)) {
        issues.push({
          type: 'error',
          message: `Checkpoint ${cp.id} at (${cp.position.x}, ${cp.position.y}) is blocked by a wall`,
          position: cp.position,
          category: 'gameplay',
        })
      }
    })

    // Design suggestions
    const totalTiles = editorBoard.tiles.flat().length
    const wallCount = editorBoard.tiles.flat().filter(tile => tile.type === 'wall').length
    const wallPercentage = (wallCount / totalTiles) * 100

    if (wallPercentage > 50) {
      issues.push({
        type: 'warning',
        message: `High wall density (${wallPercentage.toFixed(1)}%) may make the board too restrictive`,
        category: 'design',
      })
    }

    if (wallPercentage < 5) {
      issues.push({
        type: 'info',
        message: `Low wall density (${wallPercentage.toFixed(1)}%) - consider adding obstacles for strategic gameplay`,
        category: 'design',
      })
    }

    // Check conveyor belt usage
    const conveyorCount = editorBoard.tiles.flat().filter(tile => 
      tile.type === 'conveyorNormal' || tile.type === 'conveyorFast'
    ).length

    if (conveyorCount === 0) {
      issues.push({
        type: 'info',
        message: 'No conveyor belts - consider adding some for dynamic gameplay',
        category: 'design',
      })
    }

    // Performance considerations
    if (editorBoard.checkpoints.length > 10) {
      issues.push({
        type: 'warning',
        message: 'Many checkpoints may make games very long',
        category: 'performance',
      })
    }

    return issues
  }

  const issues = validateBoard()
  const errors = issues.filter(issue => issue.type === 'error')
  const warnings = issues.filter(issue => issue.type === 'warning')
  const infos = issues.filter(issue => issue.type === 'info')

  const getValidationScore = (): number => {
    if (errors.length > 0) return 0
    if (warnings.length > 2) return 60
    if (warnings.length > 0) return 80
    return 100
  }

  const validationScore = getValidationScore()
  const isValid = errors.length === 0

  const getScoreColor = (score: number): 'error' | 'warning' | 'success' => {
    if (score < 40) return 'error'
    if (score < 80) return 'warning'
    return 'success'
  }

  const getIssueIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <Error color="error" />
      case 'warning':
        return <Warning color="warning" />
      case 'info':
        return <Info color="info" />
      default:
        return <Info />
    }
  }

  return (
    <Paper sx={{ p: 2, height: '100%', overflow: 'auto' }} data-testid="validation-panel">
      <Typography variant="h6" gutterBottom>
        Board Validation
      </Typography>

      {/* Validation score */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="body2">Validation Score</Typography>
          <Chip 
            label={`${validationScore}%`}
            color={getScoreColor(validationScore)}
            size="small"
          />
        </Box>
        <LinearProgress
          variant="determinate"
          value={validationScore}
          color={getScoreColor(validationScore)}
          sx={{ height: 8, borderRadius: 4 }}
        />
      </Box>

      {/* Overall status */}
      {isValid ? (
        <Alert severity="success" sx={{ mb: 2 }}>
          <AlertTitle>Board is valid!</AlertTitle>
          This board meets all requirements and can be used for gameplay.
        </Alert>
      ) : (
        <Alert severity="error" sx={{ mb: 2 }}>
          <AlertTitle>Board has errors</AlertTitle>
          Please fix the errors below before saving or testing the board.
        </Alert>
      )}

      {/* Issues list */}
      {issues.length > 0 ? (
        <List>
          {issues.map((issue, index) => (
            <ListItem key={index}>
              <ListItemIcon>
                {getIssueIcon(issue.type)}
              </ListItemIcon>
              <ListItemText
                primary={issue.message}
                secondary={
                  issue.position 
                    ? `Position: (${issue.position.x}, ${issue.position.y}) • Category: ${issue.category}`
                    : `Category: ${issue.category}`
                }
              />
            </ListItem>
          ))}
        </List>
      ) : (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
          <CheckCircle color="success" />
          <Typography variant="body2" color="text.secondary">
            No issues found
          </Typography>
        </Box>
      )}

      {/* Quick stats */}
      {editorBoard && (
        <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle2" gutterBottom>
            Quick Stats
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            <Chip
              icon={<Home />}
              label={`${editorBoard.startPositions.length} starts`}
              size="small"
              color={editorBoard.startPositions.length > 0 ? 'success' : 'error'}
            />
            <Chip
              icon={<Flag />}
              label={`${editorBoard.checkpoints.length} checkpoints`}
              size="small"
              color={editorBoard.checkpoints.length > 0 ? 'success' : 'default'}
            />
            <Chip
              icon={<Route />}
              label={`${errors.length} errors`}
              size="small"
              color={errors.length === 0 ? 'success' : 'error'}
            />
          </Box>
        </Box>
      )}
    </Paper>
  )
}

export default ValidationPanel