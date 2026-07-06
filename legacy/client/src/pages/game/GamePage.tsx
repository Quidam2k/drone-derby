import React, { useEffect, useState } from 'react'
import {
  Box,
  Grid,
  Paper,
  Typography,
  Alert,
  Button,
  CircularProgress,
  AppBar,
  Toolbar,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material'
import {
  ExitToApp,
  Settings,
  Help,
} from '@mui/icons-material'
import { useParams, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '@/store'
import { useWebSocket } from '@/hooks/useWebSocket'

// Game components
import GameBoard from '@/components/game/GameBoard'
import CardHand from '@/components/game/CardHand'
import GameStatus from '@/components/game/GameStatus'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

// Types
import { Card as GameCard, Game, Player, Robot } from '@/shared/types/game'

const GamePage: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  
  // Redux state
  const { user } = useSelector((state: RootState) => state.auth)
  const { currentGame, isLoading, error } = useSelector((state: RootState) => state.game)
  
  // Local state
  const [selectedCards, setSelectedCards] = useState<GameCard[]>([])
  const [highlightedTiles, setHighlightedTiles] = useState<Array<{ x: number; y: number }>>([])
  const [leaveGameDialogOpen, setLeaveGameDialogOpen] = useState(false)
  const [helpDialogOpen, setHelpDialogOpen] = useState(false)

  // WebSocket connection for real-time updates
  useWebSocket(!!user)

  useEffect(() => {
    if (gameId && user) {
      // Load game data
      // This would dispatch an action to load the game
      console.log('Loading game:', gameId)
    }
  }, [gameId, user, dispatch])

  // Mock data for demonstration - this would come from Redux state
  const mockGame: Game = {
    id: gameId || '',
    name: 'Test Game',
    phase: 'programming',
    currentTurn: 1,
    maxPlayers: 4,
    board: {
      id: 'board1',
      name: 'Test Board',
      size: { width: 10, height: 10 },
      tiles: Array(10).fill(null).map(() => 
        Array(10).fill(null).map(() => ({ type: 'floor' }))
      ),
      checkpoints: [
        { id: 1, position: { x: 2, y: 2 } },
        { id: 2, position: { x: 7, y: 7 } },
      ],
      startPositions: [
        { x: 0, y: 0 },
        { x: 9, y: 0 },
        { x: 0, y: 9 },
        { x: 9, y: 9 },
      ],
    },
    createdAt: new Date(),
    lastActivity: new Date(),
  }

  const mockPlayers: Player[] = [
    {
      id: user?.id || 'player1',
      name: user?.displayName || 'You',
      playerIndex: 0,
      isReady: false,
      lastSeen: new Date(),
    },
    {
      id: 'player2',
      name: 'Player 2',
      playerIndex: 1,
      isReady: true,
      lastSeen: new Date(),
    },
  ]

  const mockRobots: Robot[] = [
    {
      id: 'robot1',
      playerId: user?.id || 'player1',
      position: { x: 0, y: 0 },
      facing: 'north',
      checkpointsReached: [],
    },
    {
      id: 'robot2',
      playerId: 'player2',
      position: { x: 9, y: 0 },
      facing: 'north',
      checkpointsReached: [1],
    },
  ]

  const mockHand: GameCard[] = [
    { id: 'card1', type: 'move1', priority: 50, register: 0 },
    { id: 'card2', type: 'move2', priority: 70, register: 0 },
    { id: 'card3', type: 'move3', priority: 90, register: 0 },
    { id: 'card4', type: 'turnLeft', priority: 30, register: 0 },
    { id: 'card5', type: 'turnRight', priority: 30, register: 0 },
    { id: 'card6', type: 'backup', priority: 10, register: 0 },
    { id: 'card7', type: 'uTurn', priority: 20, register: 0 },
  ]

  const handleCardSelect = (card: GameCard) => {
    if (selectedCards.length < 5) {
      const updatedCard = { ...card, register: selectedCards.length + 1 }
      setSelectedCards([...selectedCards, updatedCard])
    }
  }

  const handleCardDeselect = (card: GameCard) => {
    const newSelected = selectedCards.filter(c => c.id !== card.id)
    // Re-number the registers
    const reNumbered = newSelected.map((c, index) => ({ ...c, register: index + 1 }))
    setSelectedCards(reNumbered)
  }

  const handleCardsSubmit = () => {
    console.log('Submitting cards:', selectedCards)
    // This would dispatch an action to submit the turn
    // dispatch(submitTurn({ gameId, cards: selectedCards }))
  }

  const handleCardsClear = () => {
    setSelectedCards([])
  }

  const handleTileClick = (x: number, y: number) => {
    console.log('Clicked tile:', x, y)
    // This could be used for move preview or other interactions
  }

  const handleLeaveGame = () => {
    setLeaveGameDialogOpen(false)
    navigate('/dashboard')
  }

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <LoadingSpinner message="Loading game..." />
      </Box>
    )
  }

  if (error) {
    return (
      <Box p={4}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button variant="contained" onClick={() => navigate('/dashboard')}>
          Back to Dashboard
        </Button>
      </Box>
    )
  }

  const game = currentGame || mockGame
  const players = mockPlayers
  const robots = mockRobots
  const hand = mockHand

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Game Header */}
      <AppBar position="static" color="default">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            {game.name} - Turn {game.currentTurn}
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton onClick={() => setHelpDialogOpen(true)}>
              <Help />
            </IconButton>
            <IconButton>
              <Settings />
            </IconButton>
            <IconButton onClick={() => setLeaveGameDialogOpen(true)}>
              <ExitToApp />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Main Game Area */}
      <Box sx={{ flex: 1, overflow: 'hidden', p: 2 }}>
        <Grid container spacing={2} sx={{ height: '100%' }}>
          {/* Left Panel - Game Board */}
          <Grid item xs={12} md={8} sx={{ height: '100%' }}>
            <Box sx={{ 
              height: '100%', 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <GameBoard
                board={game.board!}
                players={players}
                robots={robots}
                currentPlayer={user?.id}
                highlightedTiles={highlightedTiles}
                onTileClick={handleTileClick}
                readonly={game.phase !== 'programming'}
              />
            </Box>
          </Grid>

          {/* Right Panel - Game Status */}
          <Grid item xs={12} md={4} sx={{ height: '100%' }}>
            <GameStatus
              game={game}
              currentUserId={user?.id}
              players={players}
              robots={robots}
              submittedPlayers={[]} // This would come from game state
            />
          </Grid>
        </Grid>
      </Box>

      {/* Bottom Panel - Card Hand (only show during programming phase) */}
      {game.phase === 'programming' && (
        <Paper sx={{ p: 2, borderRadius: 0 }}>
          <CardHand
            hand={hand}
            selectedCards={selectedCards}
            maxCards={5}
            onCardSelect={handleCardSelect}
            onCardDeselect={handleCardDeselect}
            onCardsSubmit={handleCardsSubmit}
            onCardsClear={handleCardsClear}
            readonly={game.phase !== 'programming'}
            showSubmitButton={true}
          />
        </Paper>
      )}

      {/* Leave Game Dialog */}
      <Dialog open={leaveGameDialogOpen} onClose={() => setLeaveGameDialogOpen(false)}>
        <DialogTitle>Leave Game</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to leave this game? You will not be able to rejoin.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLeaveGameDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleLeaveGame} color="error" variant="contained">
            Leave Game
          </Button>
        </DialogActions>
      </Dialog>

      {/* Help Dialog */}
      <Dialog open={helpDialogOpen} onClose={() => setHelpDialogOpen(false)} maxWidth="md">
        <DialogTitle>How to Play</DialogTitle>
        <DialogContent>
          <Typography paragraph>
            <strong>Objective:</strong> Program your robot to reach all checkpoints in order.
          </Typography>
          <Typography paragraph>
            <strong>Programming Phase:</strong>
          </Typography>
          <ul>
            <li>Select 5 cards from your hand to program your robot's moves</li>
            <li>Cards execute in the order you place them (Register 1-5)</li>
            <li>Higher priority numbers execute first when robots share the same register</li>
          </ul>
          <Typography paragraph>
            <strong>Execution Phase:</strong>
          </Typography>
          <ul>
            <li>All robots execute their programmed moves simultaneously</li>
            <li>Board elements (conveyors) activate after robot movements</li>
            <li>Robots can push each other if they occupy the same space</li>
          </ul>
          <Typography paragraph>
            <strong>Card Types:</strong>
          </Typography>
          <ul>
            <li><strong>Move 1-3:</strong> Move forward 1-3 spaces</li>
            <li><strong>Back Up:</strong> Move backward 1 space</li>
            <li><strong>Turn Left/Right:</strong> Rotate 90 degrees</li>
            <li><strong>U-Turn:</strong> Rotate 180 degrees</li>
          </ul>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHelpDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default GamePage