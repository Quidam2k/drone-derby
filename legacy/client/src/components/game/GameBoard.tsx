import React, { useRef, useEffect, useState } from 'react'
import { Stage, Layer, Rect, Group, Text, Circle, Image as KonvaImage } from 'react-konva'
import { Box, Paper } from '@mui/material'
import Konva from 'konva'
import { Board, Tile, Direction, Player, Robot } from '@/shared/types/game'

const TILE_SIZE = 60
const ROBOT_SIZE = 20

interface RobotProps {
  robot: Robot
  player: Player
  isCurrentPlayer?: boolean
  isAnimating?: boolean
}

const RobotComponent: React.FC<RobotProps> = ({ robot, player, isCurrentPlayer, isAnimating }) => {
  const pixelX = robot.position.x * TILE_SIZE + TILE_SIZE / 2
  const pixelY = robot.position.y * TILE_SIZE + TILE_SIZE / 2

  const getRobotColor = (playerIndex: number): string => {
    const colors = ['#f44336', '#2196f3', '#4caf50', '#ff9800'] // Red, Blue, Green, Orange
    return colors[playerIndex % colors.length]
  }

  const getDirectionRotation = (facing: Direction): number => {
    switch (facing) {
      case 'north': return 0
      case 'east': return 90
      case 'south': return 180
      case 'west': return 270
      default: return 0
    }
  }

  return (
    <Group
      x={pixelX}
      y={pixelY}
      rotation={getDirectionRotation(robot.facing)}
      opacity={isAnimating ? 0.7 : 1}
      scaleX={isCurrentPlayer ? 1.2 : 1}
      scaleY={isCurrentPlayer ? 1.2 : 1}
    >
      {/* Robot body - circle */}
      <Circle
        radius={ROBOT_SIZE / 2}
        fill={getRobotColor(player.playerIndex || 0)}
        stroke={isCurrentPlayer ? '#fff' : '#333'}
        strokeWidth={isCurrentPlayer ? 3 : 2}
        shadowBlur={5}
        shadowColor="black"
        shadowOpacity={0.3}
      />
      
      {/* Robot direction indicator - triangle */}
      <Group y={-ROBOT_SIZE / 3}>
        <Rect
          x={-2}
          y={-6}
          width={4}
          height={8}
          fill={isCurrentPlayer ? '#fff' : '#333'}
        />
      </Group>

      {/* Player name */}
      <Text
        x={-15}
        y={ROBOT_SIZE}
        width={30}
        text={player.name}
        fontSize={10}
        fontFamily="Arial"
        fill="#333"
        fontStyle="bold"
        align="center"
      />

      {/* Current checkpoint indicator */}
      {robot.checkpointsReached.length > 0 && (
        <Circle
          x={ROBOT_SIZE / 2}
          y={-ROBOT_SIZE / 2}
          radius={6}
          fill="#4caf50"
          stroke="#fff"
          strokeWidth={1}
        />
      )}
      {robot.checkpointsReached.length > 0 && (
        <Text
          x={ROBOT_SIZE / 2 - 3}
          y={-ROBOT_SIZE / 2 - 3}
          text={robot.checkpointsReached.length.toString()}
          fontSize={8}
          fontFamily="Arial"
          fill="white"
          fontStyle="bold"
        />
      )}
    </Group>
  )
}

interface TileProps {
  tile: Tile
  x: number
  y: number
  isHighlighted?: boolean
}

const TileComponent: React.FC<TileProps> = ({ tile, x, y, isHighlighted }) => {
  const pixelX = x * TILE_SIZE
  const pixelY = y * TILE_SIZE

  const getTileColor = (tileType: string): string => {
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

  return (
    <Group>
      {/* Main tile */}
      <Rect
        x={pixelX}
        y={pixelY}
        width={TILE_SIZE}
        height={TILE_SIZE}
        fill={getTileColor(tile.type)}
        stroke={isHighlighted ? '#ff5722' : '#ccc'}
        strokeWidth={isHighlighted ? 3 : 1}
        shadowBlur={tile.type === 'wall' ? 5 : 0}
        shadowColor="black"
        shadowOpacity={tile.type === 'wall' ? 0.3 : 0}
      />

      {/* Conveyor arrow */}
      {(tile.type === 'conveyorNormal' || tile.type === 'conveyorFast') && tile.direction && (
        <Text
          x={pixelX + TILE_SIZE / 2 - 10}
          y={pixelY + TILE_SIZE / 2 - 10}
          text={
            tile.direction === 'north' ? '↑' :
            tile.direction === 'south' ? '↓' :
            tile.direction === 'east' ? '→' : '←'
          }
          fontSize={24}
          fontFamily="Arial"
          fill="white"
          fontStyle="bold"
          stroke="#333"
          strokeWidth={1}
        />
      )}

      {/* Fast conveyor double arrow */}
      {tile.type === 'conveyorFast' && tile.direction && (
        <Text
          x={pixelX + TILE_SIZE / 2 - 8}
          y={pixelY + TILE_SIZE / 2 - 16}
          text={
            tile.direction === 'north' ? '↑' :
            tile.direction === 'south' ? '↓' :
            tile.direction === 'east' ? '→' : '←'
          }
          fontSize={16}
          fontFamily="Arial"
          fill="white"
          fontStyle="bold"
          stroke="#333"
          strokeWidth={0.5}
          opacity={0.7}
        />
      )}

      {/* Checkpoint number */}
      {tile.type === 'checkpoint' && tile.checkpointNumber && (
        <Circle
          x={pixelX + TILE_SIZE / 2}
          y={pixelY + TILE_SIZE / 2}
          radius={15}
          fill="white"
          stroke="#333"
          strokeWidth={2}
        />
      )}
      {tile.type === 'checkpoint' && tile.checkpointNumber && (
        <Text
          x={pixelX + TILE_SIZE / 2 - 6}
          y={pixelY + TILE_SIZE / 2 - 8}
          text={tile.checkpointNumber.toString()}
          fontSize={16}
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
          radius={12}
          fill="white"
          stroke="#333"
          strokeWidth={2}
        />
      )}
      {tile.type === 'start' && (
        <Text
          x={pixelX + TILE_SIZE / 2 - 5}
          y={pixelY + TILE_SIZE / 2 - 8}
          text="S"
          fontSize={14}
          fontFamily="Arial"
          fill="black"
          fontStyle="bold"
        />
      )}

      {/* Highlight overlay for movement preview */}
      {isHighlighted && (
        <Rect
          x={pixelX}
          y={pixelY}
          width={TILE_SIZE}
          height={TILE_SIZE}
          fill="rgba(255, 87, 34, 0.3)"
          stroke="#ff5722"
          strokeWidth={2}
          dash={[5, 5]}
        />
      )}
    </Group>
  )
}

interface GameBoardProps {
  board: Board
  players: Player[]
  robots: Robot[]
  currentPlayer?: string
  highlightedTiles?: Array<{ x: number; y: number }>
  onTileClick?: (x: number, y: number) => void
  showGrid?: boolean
  readonly?: boolean
}

const GameBoard: React.FC<GameBoardProps> = ({
  board,
  players,
  robots,
  currentPlayer,
  highlightedTiles = [],
  onTileClick,
  showGrid = true,
  readonly = false,
}) => {
  const stageRef = useRef<Konva.Stage>(null)
  const [animatingRobots, setAnimatingRobots] = useState<Set<string>>(new Set())

  const boardWidth = board.size?.width || 10
  const boardHeight = board.size?.height || 10

  const handleTileClick = (x: number, y: number) => {
    if (!readonly && onTileClick) {
      onTileClick(x, y)
    }
  }

  const isHighlighted = (x: number, y: number): boolean => {
    return highlightedTiles.some(tile => tile.x === x && tile.y === y)
  }

  const getPlayerByRobot = (robot: Robot): Player | undefined => {
    return players.find(player => player.id === robot.playerId)
  }

  const animateRobotMovement = (robotId: string, fromPos: { x: number; y: number }, toPos: { x: number; y: number }) => {
    setAnimatingRobots(prev => new Set(prev).add(robotId))
    
    // Animation would be implemented here using Konva's animation API
    // For now, just remove the animation state after a delay
    setTimeout(() => {
      setAnimatingRobots(prev => {
        const newSet = new Set(prev)
        newSet.delete(robotId)
        return newSet
      })
    }, 500)
  }

  return (
    <Paper 
      sx={{ 
        p: 2, 
        display: 'flex', 
        justifyContent: 'center',
        backgroundColor: 'background.paper',
        border: '2px solid #333',
        borderRadius: 2,
      }}
    >
      <Stage
        ref={stageRef}
        width={boardWidth * TILE_SIZE}
        height={boardHeight * TILE_SIZE}
        onClick={(e) => {
          if (!readonly) {
            const pos = e.target.getStage()?.getPointerPosition()
            if (pos) {
              const x = Math.floor(pos.x / TILE_SIZE)
              const y = Math.floor(pos.y / TILE_SIZE)
              if (x >= 0 && x < boardWidth && y >= 0 && y < boardHeight) {
                handleTileClick(x, y)
              }
            }
          }
        }}
      >
        <Layer>
          {/* Grid lines */}
          {showGrid && Array.from({ length: boardWidth + 1 }, (_, i) => (
            <Rect
              key={`v-line-${i}`}
              x={i * TILE_SIZE}
              y={0}
              width={1}
              height={boardHeight * TILE_SIZE}
              fill="#ddd"
            />
          ))}
          {showGrid && Array.from({ length: boardHeight + 1 }, (_, i) => (
            <Rect
              key={`h-line-${i}`}
              x={0}
              y={i * TILE_SIZE}
              width={boardWidth * TILE_SIZE}
              height={1}
              fill="#ddd"
            />
          ))}

          {/* Tiles */}
          {board.tiles.map((row, y) =>
            row.map((tile, x) => (
              <TileComponent
                key={`tile-${x}-${y}`}
                tile={tile}
                x={x}
                y={y}
                isHighlighted={isHighlighted(x, y)}
              />
            ))
          )}

          {/* Robots */}
          {robots.map((robot) => {
            const player = getPlayerByRobot(robot)
            if (!player) return null

            return (
              <RobotComponent
                key={robot.id || `robot-${robot.playerId}`}
                robot={robot}
                player={player}
                isCurrentPlayer={player.id === currentPlayer}
                isAnimating={animatingRobots.has(robot.id || robot.playerId)}
              />
            )
          })}
        </Layer>
      </Stage>
    </Paper>
  )
}

export default GameBoard