import React, { useRef, useEffect, useState } from 'react'
import { Stage, Layer, Rect, Group, Text, Circle } from 'react-konva'
import { useDrop } from 'react-dnd'
import { useDispatch, useSelector } from 'react-redux'
import { Box, Paper } from '@mui/material'
import Konva from 'konva'
import { RootState } from '@/store'
import { updateTile, addCheckpoint, removeCheckpoint, addStartPosition, removeStartPosition } from '@/store/slices/boardSlice'
import { TileType, Direction, Tile } from '@/shared/types/game'

const TILE_SIZE = 50
const BOARD_WIDTH = 10
const BOARD_HEIGHT = 10

interface TileProps {
  tile: Tile
  x: number
  y: number
  onClick: () => void
  onRightClick: () => void
}

const TileComponent: React.FC<TileProps> = ({ tile, x, y, onClick, onRightClick }) => {
  const pixelX = x * TILE_SIZE
  const pixelY = y * TILE_SIZE

  const getTileColor = (tileType: TileType): string => {
    switch (tileType) {
      case 'floor':
        return '#f5f5f5'
      case 'wall':
        return '#424242'
      case 'conveyorNormal':
        return '#81c784'
      case 'conveyorFast':
        return '#4caf50'
      case 'checkpoint':
        return '#ffb74d'
      case 'start':
        return '#64b5f6'
      default:
        return '#f5f5f5'
    }
  }

  const getArrowPoints = (direction: Direction): number[] => {
    const centerX = pixelX + TILE_SIZE / 2
    const centerY = pixelY + TILE_SIZE / 2
    const arrowSize = 15

    switch (direction) {
      case 'north':
        return [
          centerX, centerY - arrowSize,
          centerX - arrowSize / 2, centerY + arrowSize / 2,
          centerX + arrowSize / 2, centerY + arrowSize / 2,
        ]
      case 'south':
        return [
          centerX, centerY + arrowSize,
          centerX - arrowSize / 2, centerY - arrowSize / 2,
          centerX + arrowSize / 2, centerY - arrowSize / 2,
        ]
      case 'east':
        return [
          centerX + arrowSize, centerY,
          centerX - arrowSize / 2, centerY - arrowSize / 2,
          centerX - arrowSize / 2, centerY + arrowSize / 2,
        ]
      case 'west':
        return [
          centerX - arrowSize, centerY,
          centerX + arrowSize / 2, centerY - arrowSize / 2,
          centerX + arrowSize / 2, centerY + arrowSize / 2,
        ]
      default:
        return []
    }
  }

  return (
    <Group
      onClick={onClick}
      onContextMenu={(e) => {
        e.evt.preventDefault()
        onRightClick()
      }}
    >
      {/* Main tile */}
      <Rect
        x={pixelX}
        y={pixelY}
        width={TILE_SIZE}
        height={TILE_SIZE}
        fill={getTileColor(tile.type)}
        stroke="#ccc"
        strokeWidth={1}
        shadowBlur={tile.type === 'wall' ? 5 : 0}
        shadowColor="black"
        shadowOpacity={tile.type === 'wall' ? 0.3 : 0}
      />

      {/* Conveyor arrow */}
      {(tile.type === 'conveyorNormal' || tile.type === 'conveyorFast') && tile.direction && (
        <Text
          x={pixelX + TILE_SIZE / 2 - 8}
          y={pixelY + TILE_SIZE / 2 - 8}
          text={
            tile.direction === 'north' ? '↑' :
            tile.direction === 'south' ? '↓' :
            tile.direction === 'east' ? '→' : '←'
          }
          fontSize={20}
          fontFamily="Arial"
          fill="white"
          fontStyle="bold"
          stroke="#333"
          strokeWidth={1}
        />
      )}

      {/* Checkpoint number */}
      {tile.type === 'checkpoint' && tile.checkpointNumber && (
        <Circle
          x={pixelX + TILE_SIZE / 2}
          y={pixelY + TILE_SIZE / 2}
          radius={12}
          fill="white"
          stroke="#333"
          strokeWidth={2}
        />
      )}
      {tile.type === 'checkpoint' && tile.checkpointNumber && (
        <Text
          x={pixelX + TILE_SIZE / 2 - 5}
          y={pixelY + TILE_SIZE / 2 - 6}
          text={tile.checkpointNumber.toString()}
          fontSize={14}
          fontFamily="Arial"
          fill="black"
          fontStyle="bold"
        />
      )}

      {/* Start position marker */}
      {tile.type === 'start' && (
        <Circle
          x={pixelX + TILE_SIZE / 2}
          y={pixelY + TILE_SIZE / 2}
          radius={8}
          fill="white"
          stroke="#333"
          strokeWidth={2}
        />
      )}
      {tile.type === 'start' && (
        <Text
          x={pixelX + TILE_SIZE / 2 - 3}
          y={pixelY + TILE_SIZE / 2 - 6}
          text="S"
          fontSize={12}
          fontFamily="Arial"
          fill="black"
          fontStyle="bold"
        />
      )}
    </Group>
  )
}

interface BoardCanvasProps {
  onTileSelect?: (x: number, y: number, tile: Tile) => void
}

const BoardCanvas: React.FC<BoardCanvasProps> = ({ onTileSelect }) => {
  const dispatch = useDispatch()
  const { editorBoard } = useSelector((state: RootState) => state.board)
  const stageRef = useRef<Konva.Stage>(null)
  const [draggedTile, setDraggedTile] = useState<Tile | null>(null)

  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'tile',
    drop: (item: { tile: Tile }, monitor) => {
      if (!monitor.didDrop()) {
        const offset = monitor.getSourceClientOffset()
        if (offset && stageRef.current) {
          const stage = stageRef.current
          const rect = stage.container().getBoundingClientRect()
          const x = Math.floor((offset.x - rect.left) / TILE_SIZE)
          const y = Math.floor((offset.y - rect.top) / TILE_SIZE)
          
          if (x >= 0 && x < BOARD_WIDTH && y >= 0 && y < BOARD_HEIGHT) {
            handleTilePlacement(x, y, item.tile)
          }
        }
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }))

  const handleTilePlacement = (x: number, y: number, tile: Tile) => {
    if (!editorBoard) return

    // Handle special tile types
    if (tile.type === 'checkpoint') {
      // Remove existing checkpoint at this position
      if (editorBoard.tiles[y][x].type === 'checkpoint') {
        dispatch(removeCheckpoint({ x, y }))
      } else {
        dispatch(addCheckpoint({ x, y }))
      }
    } else if (tile.type === 'start') {
      // Toggle start position
      if (editorBoard.tiles[y][x].type === 'start') {
        dispatch(removeStartPosition({ x, y }))
      } else {
        dispatch(addStartPosition({ x, y }))
      }
    } else {
      // Regular tile placement
      dispatch(updateTile({ x, y, tile }))
    }
  }

  const handleTileClick = (x: number, y: number) => {
    if (!editorBoard) return
    
    const tile = editorBoard.tiles[y][x]
    if (onTileSelect) {
      onTileSelect(x, y, tile)
    }
  }

  const handleTileRightClick = (x: number, y: number) => {
    if (!editorBoard) return
    
    // Right-click to place floor tile (erase)
    dispatch(updateTile({ x, y, tile: { type: 'floor' } }))
  }

  if (!editorBoard) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <Box>No board loaded. Create a new board to start editing.</Box>
      </Paper>
    )
  }

  return (
    <Paper 
      ref={drop}
      data-testid="board-canvas"
      sx={{ 
        p: 2, 
        display: 'flex', 
        justifyContent: 'center',
        backgroundColor: isOver ? 'action.hover' : 'background.paper',
        border: '2px dashed',
        borderColor: isOver ? 'primary.main' : 'transparent',
        transition: 'all 0.2s ease',
      }}
    >
      <Stage
        ref={stageRef}
        width={BOARD_WIDTH * TILE_SIZE}
        height={BOARD_HEIGHT * TILE_SIZE}
        style={{ border: '2px solid #333' }}
      >
        <Layer>
          {/* Grid lines */}
          {Array.from({ length: BOARD_WIDTH + 1 }, (_, i) => (
            <Rect
              key={`v-line-${i}`}
              x={i * TILE_SIZE}
              y={0}
              width={1}
              height={BOARD_HEIGHT * TILE_SIZE}
              fill="#ddd"
            />
          ))}
          {Array.from({ length: BOARD_HEIGHT + 1 }, (_, i) => (
            <Rect
              key={`h-line-${i}`}
              x={0}
              y={i * TILE_SIZE}
              width={BOARD_WIDTH * TILE_SIZE}
              height={1}
              fill="#ddd"
            />
          ))}

          {/* Tiles */}
          {editorBoard.tiles.map((row, y) =>
            row.map((tile, x) => (
              <TileComponent
                key={`tile-${x}-${y}`}
                tile={tile}
                x={x}
                y={y}
                onClick={() => handleTileClick(x, y)}
                onRightClick={() => handleTileRightClick(x, y)}
              />
            ))
          )}
        </Layer>
      </Stage>
    </Paper>
  )
}

export default BoardCanvas