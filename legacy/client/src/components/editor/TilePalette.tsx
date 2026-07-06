import React from 'react'
import {
  Box,
  Paper,
  Typography,
  Grid,
  IconButton,
  Tooltip,
  Divider,
} from '@mui/material'
import {
  CropSquareOutlined,
  CropDinOutlined,
  ArrowForward,
  ArrowBack,
  ArrowUpward,
  ArrowDownward,
  FlagOutlined,
  HomeOutlined,
} from '@mui/icons-material'
import { useDrag } from 'react-dnd'
import { TileType, Direction, Tile } from '@/shared/types/game'

interface DraggableTileProps {
  tile: Tile
  icon: React.ReactNode
  name: string
  description: string
}

const DraggableTile: React.FC<DraggableTileProps> = ({ tile, icon, name, description }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'tile',
    item: { tile },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }))

  return (
    <Tooltip title={description} placement="right">
      <Paper
        ref={drag}
        data-testid={`tile-${tile.type}${tile.direction ? `-${tile.direction}` : ''}`}
        sx={{
          p: 1,
          cursor: 'grab',
          opacity: isDragging ? 0.5 : 1,
          '&:hover': {
            bgcolor: 'action.hover',
          },
          '&:active': {
            cursor: 'grabbing',
          },
          border: '2px solid transparent',
          borderColor: isDragging ? 'primary.main' : 'transparent',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0.5,
        }}
      >
        <Box sx={{ fontSize: '1.5rem', color: 'text.primary' }}>
          {icon}
        </Box>
        <Typography variant="caption" align="center" sx={{ fontSize: '0.7rem' }}>
          {name}
        </Typography>
      </Paper>
    </Tooltip>
  )
}

const TilePalette: React.FC = () => {
  const basicTiles: Array<{ tile: Tile; icon: React.ReactNode; name: string; description: string }> = [
    {
      tile: { type: 'floor' },
      icon: <CropSquareOutlined />,
      name: 'Floor',
      description: 'Basic floor tile - robots can move here freely',
    },
    {
      tile: { type: 'wall' },
      icon: <CropDinOutlined />,
      name: 'Wall',
      description: 'Wall tile - blocks robot movement',
    },
    {
      tile: { type: 'start' },
      icon: <HomeOutlined />,
      name: 'Start',
      description: 'Starting position for robots',
    },
    {
      tile: { type: 'checkpoint' },
      icon: <FlagOutlined />,
      name: 'Checkpoint',
      description: 'Checkpoint tile - robots must visit in order',
    },
  ]

  const conveyorTiles: Array<{ tile: Tile; icon: React.ReactNode; name: string; description: string }> = [
    {
      tile: { type: 'conveyorNormal', direction: 'north' },
      icon: <ArrowUpward />,
      name: 'Conv ↑',
      description: 'Normal conveyor belt - moves robots north',
    },
    {
      tile: { type: 'conveyorNormal', direction: 'south' },
      icon: <ArrowDownward />,
      name: 'Conv ↓',
      description: 'Normal conveyor belt - moves robots south',
    },
    {
      tile: { type: 'conveyorNormal', direction: 'east' },
      icon: <ArrowForward />,
      name: 'Conv →',
      description: 'Normal conveyor belt - moves robots east',
    },
    {
      tile: { type: 'conveyorNormal', direction: 'west' },
      icon: <ArrowBack />,
      name: 'Conv ←',
      description: 'Normal conveyor belt - moves robots west',
    },
  ]

  const fastConveyorTiles: Array<{ tile: Tile; icon: React.ReactNode; name: string; description: string }> = [
    {
      tile: { type: 'conveyorFast', direction: 'north' },
      icon: (
        <Box sx={{ position: 'relative' }}>
          <ArrowUpward />
          <ArrowUpward sx={{ position: 'absolute', top: -2, left: 0, fontSize: '0.8rem' }} />
        </Box>
      ),
      name: 'Fast ↑',
      description: 'Fast conveyor belt - moves robots north twice',
    },
    {
      tile: { type: 'conveyorFast', direction: 'south' },
      icon: (
        <Box sx={{ position: 'relative' }}>
          <ArrowDownward />
          <ArrowDownward sx={{ position: 'absolute', top: 2, left: 0, fontSize: '0.8rem' }} />
        </Box>
      ),
      name: 'Fast ↓',
      description: 'Fast conveyor belt - moves robots south twice',
    },
    {
      tile: { type: 'conveyorFast', direction: 'east' },
      icon: (
        <Box sx={{ position: 'relative' }}>
          <ArrowForward />
          <ArrowForward sx={{ position: 'absolute', top: 0, left: 2, fontSize: '0.8rem' }} />
        </Box>
      ),
      name: 'Fast →',
      description: 'Fast conveyor belt - moves robots east twice',
    },
    {
      tile: { type: 'conveyorFast', direction: 'west' },
      icon: (
        <Box sx={{ position: 'relative' }}>
          <ArrowBack />
          <ArrowBack sx={{ position: 'absolute', top: 0, left: -2, fontSize: '0.8rem' }} />
        </Box>
      ),
      name: 'Fast ←',
      description: 'Fast conveyor belt - moves robots west twice',
    },
  ]

  return (
    <Paper sx={{ p: 2, height: '100%', overflow: 'auto' }} data-testid="tile-palette">
      <Typography variant="h6" gutterBottom>
        Tile Palette
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Drag tiles onto the board to place them
      </Typography>

      <Divider sx={{ my: 2 }} />

      <Typography variant="subtitle2" gutterBottom>
        Basic Tiles
      </Typography>
      <Grid container spacing={1} sx={{ mb: 2 }}>
        {basicTiles.map((tileData, index) => (
          <Grid item xs={6} key={`basic-${index}`}>
            <DraggableTile {...tileData} />
          </Grid>
        ))}
      </Grid>

      <Divider sx={{ my: 2 }} />

      <Typography variant="subtitle2" gutterBottom>
        Normal Conveyors
      </Typography>
      <Grid container spacing={1} sx={{ mb: 2 }}>
        {conveyorTiles.map((tileData, index) => (
          <Grid item xs={6} key={`conveyor-${index}`}>
            <DraggableTile {...tileData} />
          </Grid>
        ))}
      </Grid>

      <Divider sx={{ my: 2 }} />

      <Typography variant="subtitle2" gutterBottom>
        Fast Conveyors
      </Typography>
      <Grid container spacing={1}>
        {fastConveyorTiles.map((tileData, index) => (
          <Grid item xs={6} key={`fast-conveyor-${index}`}>
            <DraggableTile {...tileData} />
          </Grid>
        ))}
      </Grid>
    </Paper>
  )
}

export default TilePalette