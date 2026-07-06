import React from 'react'
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Chip,
  LinearProgress,
  Divider,
  Card,
  CardContent,
  Grid,
  Tooltip,
} from '@mui/material'
import {
  Person,
  Flag,
  Timer,
  PlayArrow,
  Pause,
  CheckCircle,
  RadioButtonUnchecked,
  Speed,
} from '@mui/icons-material'
import { Game, Player, Robot, GamePhase } from '@/shared/types/game'

interface PlayerStatusProps {
  player: Player
  robot?: Robot
  isCurrentPlayer: boolean
  hasSubmittedTurn?: boolean
}

const PlayerStatus: React.FC<PlayerStatusProps> = ({ 
  player, 
  robot, 
  isCurrentPlayer, 
  hasSubmittedTurn = false 
}) => {
  const getPlayerColor = (playerIndex: number): string => {
    const colors = ['#f44336', '#2196f3', '#4caf50', '#ff9800'] // Red, Blue, Green, Orange
    return colors[playerIndex % colors.length]
  }

  const getCheckpointProgress = (): number => {
    if (!robot) return 0
    // Assuming there are checkpoints 1-5 typically
    const maxCheckpoints = 5 // This could be dynamic based on board
    return (robot.checkpointsReached.length / maxCheckpoints) * 100
  }

  return (
    <ListItem>
      <ListItemAvatar>
        <Avatar 
          sx={{ 
            bgcolor: getPlayerColor(player.playerIndex || 0),
            border: isCurrentPlayer ? '3px solid #fff' : 'none',
            boxShadow: isCurrentPlayer ? '0 0 0 2px #2196f3' : 'none',
          }}
        >
          <Person />
        </Avatar>
      </ListItemAvatar>
      <ListItemText
        primary={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle1">
              {player.name}
            </Typography>
            {isCurrentPlayer && (
              <Chip 
                label="You" 
                size="small" 
                color="primary" 
                variant="filled" 
              />
            )}
          </Box>
        }
        secondary={
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
              <Flag fontSize="small" />
              <Typography variant="caption">
                Checkpoints: {robot?.checkpointsReached.length || 0}
              </Typography>
              {robot && robot.checkpointsReached.length > 0 && (
                <Tooltip title={`Reached: ${robot.checkpointsReached.join(', ')}`}>
                  <CheckCircle fontSize="small" color="success" />
                </Tooltip>
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
              {hasSubmittedTurn ? (
                <Chip 
                  icon={<CheckCircle />}
                  label="Ready" 
                  size="small" 
                  color="success" 
                  variant="outlined" 
                />
              ) : (
                <Chip 
                  icon={<RadioButtonUnchecked />}
                  label="Programming" 
                  size="small" 
                  color="warning" 
                  variant="outlined" 
                />
              )}
            </Box>
            {robot && getCheckpointProgress() > 0 && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Progress
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={getCheckpointProgress()} 
                  sx={{ height: 4, borderRadius: 2 }}
                />
              </Box>
            )}
          </Box>
        }
      />
    </ListItem>
  )
}

interface GameStatusProps {
  game: Game
  currentUserId?: string
  players: Player[]
  robots: Robot[]
  submittedPlayers?: string[]
}

const GameStatus: React.FC<GameStatusProps> = ({
  game,
  currentUserId,
  players,
  robots,
  submittedPlayers = [],
}) => {
  const getPhaseIcon = (phase: GamePhase) => {
    switch (phase) {
      case 'waiting':
        return <Pause />
      case 'programming':
        return <Timer />
      case 'executing':
        return <PlayArrow />
      case 'complete':
        return <CheckCircle />
      default:
        return <Timer />
    }
  }

  const getPhaseDescription = (phase: GamePhase): string => {
    switch (phase) {
      case 'waiting':
        return 'Waiting for players to join'
      case 'programming':
        return 'Players are programming their robots'
      case 'executing':
        return 'Executing programmed moves'
      case 'complete':
        return 'Game complete'
      default:
        return 'Unknown phase'
    }
  }

  const getPhaseColor = (phase: GamePhase) => {
    switch (phase) {
      case 'waiting':
        return 'warning'
      case 'programming':
        return 'info'
      case 'executing':
        return 'success'
      case 'complete':
        return 'success'
      default:
        return 'default'
    }
  }

  const getRobotForPlayer = (playerId: string): Robot | undefined => {
    return robots.find(robot => robot.playerId === playerId)
  }

  const getWinnerInfo = () => {
    if (game.phase !== 'complete') return null
    
    // Find the player with the most checkpoints or who completed the race
    const playersWithProgress = players.map(player => {
      const robot = getRobotForPlayer(player.id)
      return {
        player,
        checkpoints: robot?.checkpointsReached.length || 0,
        robot,
      }
    })

    playersWithProgress.sort((a, b) => b.checkpoints - a.checkpoints)
    
    return playersWithProgress[0]
  }

  const winner = getWinnerInfo()
  const readyPlayers = submittedPlayers.length
  const totalPlayers = players.length

  return (
    <Paper sx={{ p: 2, height: '100%' }}>
      {/* Game Info */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Game Status
        </Typography>
        
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {getPhaseIcon(game.phase)}
                  <Typography variant="h6">
                    Turn {game.currentTurn}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs>
                <Chip
                  label={game.phase.charAt(0).toUpperCase() + game.phase.slice(1)}
                  color={getPhaseColor(game.phase)}
                  icon={getPhaseIcon(game.phase)}
                />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {getPhaseDescription(game.phase)}
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Turn Progress */}
        {game.phase === 'programming' && (
          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Speed />
                <Typography variant="subtitle2">
                  Turn Progress
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2">
                  Players ready: {readyPlayers}/{totalPlayers}
                </Typography>
                <Typography variant="body2">
                  {Math.round((readyPlayers / totalPlayers) * 100)}%
                </Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={(readyPlayers / totalPlayers) * 100}
                sx={{ height: 8, borderRadius: 4 }}
              />
            </CardContent>
          </Card>
        )}

        {/* Winner Display */}
        {winner && game.phase === 'complete' && (
          <Card variant="outlined" sx={{ mb: 2, bgcolor: 'success.light' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CheckCircle color="success" />
                <Typography variant="h6" color="success.main">
                  Winner: {winner.player.name}
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Completed with {winner.checkpoints} checkpoints
              </Typography>
            </CardContent>
          </Card>
        )}
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Players List */}
      <Typography variant="h6" gutterBottom>
        Players ({players.length}/{game.maxPlayers})
      </Typography>
      
      <List>
        {players.map((player) => (
          <PlayerStatus
            key={player.id}
            player={player}
            robot={getRobotForPlayer(player.id)}
            isCurrentPlayer={player.id === currentUserId}
            hasSubmittedTurn={submittedPlayers.includes(player.id)}
          />
        ))}
      </List>

      {/* Game Settings */}
      <Divider sx={{ my: 2 }} />
      
      <Typography variant="subtitle2" gutterBottom>
        Game Settings
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        <Chip 
          label={`Max Players: ${game.maxPlayers}`} 
          size="small" 
          variant="outlined" 
        />
        <Chip 
          label={`Board: ${game.board?.name || 'Unknown'}`} 
          size="small" 
          variant="outlined" 
        />
      </Box>
    </Paper>
  )
}

export default GameStatus