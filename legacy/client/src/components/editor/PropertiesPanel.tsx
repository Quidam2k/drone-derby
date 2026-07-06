import React from 'react'
import {
  Paper,
  Typography,
  Box,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Button,
} from '@mui/material'
import {
  North,
  South,
  East,
  West,
  Delete,
  Add,
} from '@mui/icons-material'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '@/store'
import { updateTile, removeCheckpoint, removeStartPosition } from '@/store/slices/boardSlice'
import { Tile, Direction } from '@/shared/types/game'

interface PropertiesPanelProps {
  selectedTile?: {
    x: number
    y: number
    tile: Tile
  }
  onTileDeselect?: () => void
}

const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ 
  selectedTile, 
  onTileDeselect 
}) => {
  const dispatch = useDispatch()
  const { editorBoard } = useSelector((state: RootState) => state.board)

  const handleDirectionChange = (direction: Direction) => {
    if (!selectedTile) return

    const updatedTile: Tile = {
      ...selectedTile.tile,
      direction,
    }

    dispatch(updateTile({
      x: selectedTile.x,
      y: selectedTile.y,
      tile: updatedTile,
    }))
  }

  const handleRemoveCheckpoint = (x: number, y: number) => {
    dispatch(removeCheckpoint({ x, y }))
  }

  const handleRemoveStartPosition = (x: number, y: number) => {
    dispatch(removeStartPosition({ x, y }))
  }

  const DirectionSelector: React.FC<{ 
    currentDirection?: Direction
    onChange: (direction: Direction) => void
  }> = ({ currentDirection, onChange }) => (
    <FormControl component="fieldset" sx={{ mt: 2 }}>
      <FormLabel component="legend">Direction</FormLabel>
      <RadioGroup
        value={currentDirection || 'north'}
        onChange={(e) => onChange(e.target.value as Direction)}
        row
      >
        <FormControlLabel
          value="north"
          control={<Radio />}
          label={<North />}
        />
        <FormControlLabel
          value="south"
          control={<Radio />}
          label={<South />}
        />
        <FormControlLabel
          value="east"
          control={<Radio />}
          label={<East />}
        />
        <FormControlLabel
          value="west"
          control={<Radio />}
          label={<West />}
        />
      </RadioGroup>
    </FormControl>
  )

  return (
    <Paper sx={{ p: 2, height: '100%', overflow: 'auto' }} data-testid="properties-panel">
      <Typography variant="h6" gutterBottom>
        Properties
      </Typography>

      {selectedTile ? (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1">
              Selected Tile ({selectedTile.x}, {selectedTile.y})
            </Typography>
            <Button size="small" onClick={onTileDeselect} data-testid="deselect-tile">
              Deselect
            </Button>
          </Box>

          <Chip 
            label={selectedTile.tile.type.charAt(0).toUpperCase() + selectedTile.tile.type.slice(1)}
            color="primary"
            data-testid="selected-tile-type"
            sx={{ mb: 2 }}
          />

          {/* Direction selector for conveyor tiles */}
          {(selectedTile.tile.type === 'conveyorNormal' || selectedTile.tile.type === 'conveyorFast') && (
            <DirectionSelector
              currentDirection={selectedTile.tile.direction}
              onChange={handleDirectionChange}
            />
          )}

          {/* Checkpoint info */}
          {selectedTile.tile.type === 'checkpoint' && selectedTile.tile.checkpointNumber && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Checkpoint Number: {selectedTile.tile.checkpointNumber}
              </Typography>
            </Box>
          )}
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary">
          Click on a tile to view and edit its properties
        </Typography>
      )}

      <Divider sx={{ my: 3 }} />

      {/* Board overview */}
      <Typography variant="h6" gutterBottom>
        Board Overview
      </Typography>

      {editorBoard && (
        <Box>
          {/* Start positions */}
          <Typography variant="subtitle2" gutterBottom>
            Start Positions ({editorBoard.startPositions.length}/4)
          </Typography>
          {editorBoard.startPositions.length > 0 ? (
            <List dense>
              {editorBoard.startPositions.map((pos, index) => (
                <ListItem key={`start-${index}`}>
                  <ListItemText 
                    primary={`Position ${index + 1}`}
                    secondary={`(${pos.x}, ${pos.y})`}
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      onClick={() => handleRemoveStartPosition(pos.x, pos.y)}
                      size="small"
                    >
                      <Delete />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              No start positions defined
            </Typography>
          )}

          <Divider sx={{ my: 2 }} />

          {/* Checkpoints */}
          <Typography variant="subtitle2" gutterBottom>
            Checkpoints ({editorBoard.checkpoints.length})
          </Typography>
          {editorBoard.checkpoints.length > 0 ? (
            <List dense>
              {editorBoard.checkpoints
                .sort((a, b) => a.id - b.id)
                .map((checkpoint) => (
                  <ListItem key={`checkpoint-${checkpoint.id}`}>
                    <ListItemText 
                      primary={`Checkpoint ${checkpoint.id}`}
                      secondary={`(${checkpoint.position.x}, ${checkpoint.position.y})`}
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        onClick={() => handleRemoveCheckpoint(checkpoint.position.x, checkpoint.position.y)}
                        size="small"
                      >
                        <Delete />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
            </List>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              No checkpoints defined
            </Typography>
          )}

          <Divider sx={{ my: 2 }} />

          {/* Tile counts */}
          <Typography variant="subtitle2" gutterBottom>
            Tile Statistics
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {(() => {
              const tileCounts: Record<string, number> = {}
              editorBoard.tiles.flat().forEach(tile => {
                tileCounts[tile.type] = (tileCounts[tile.type] || 0) + 1
              })
              
              return Object.entries(tileCounts).map(([type, count]) => (
                <Chip
                  key={type}
                  label={`${type}: ${count}`}
                  size="small"
                  variant="outlined"
                />
              ))
            })()}
          </Box>
        </Box>
      )}
    </Paper>
  )
}

export default PropertiesPanel