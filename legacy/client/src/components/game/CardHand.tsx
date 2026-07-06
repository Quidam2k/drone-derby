import React, { useState } from 'react'
import {
  Box,
  Paper,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Grid,
  Chip,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
} from '@mui/material'
import {
  ArrowUpward,
  ArrowDownward,
  RotateLeft,
  RotateRight,
  UTurnLeft,
  Speed,
  PlayArrow,
  Clear,
} from '@mui/icons-material'
import { useDispatch, useSelector } from 'react-redux'
import { RootState } from '@/store'
import { Card as GameCard, CardType } from '@/shared/types/game'

interface CardProps {
  card: GameCard
  isSelected: boolean
  isDisabled?: boolean
  onClick: () => void
  showPriority?: boolean
}

const CardComponent: React.FC<CardProps> = ({ 
  card, 
  isSelected, 
  isDisabled, 
  onClick,
  showPriority = false 
}) => {
  const getCardIcon = (type: CardType) => {
    switch (type) {
      case 'move1':
      case 'move2':
      case 'move3':
        return <ArrowUpward />
      case 'backup':
        return <ArrowDownward />
      case 'turnLeft':
        return <RotateLeft />
      case 'turnRight':
        return <RotateRight />
      case 'uTurn':
        return <UTurnLeft />
      default:
        return <Speed />
    }
  }

  const getCardName = (type: CardType): string => {
    switch (type) {
      case 'move1':
        return 'Move 1'
      case 'move2':
        return 'Move 2'
      case 'move3':
        return 'Move 3'
      case 'backup':
        return 'Back Up'
      case 'turnLeft':
        return 'Turn Left'
      case 'turnRight':
        return 'Turn Right'
      case 'uTurn':
        return 'U-Turn'
      default:
        return type
    }
  }

  const getCardDescription = (type: CardType): string => {
    switch (type) {
      case 'move1':
        return 'Move forward 1 space'
      case 'move2':
        return 'Move forward 2 spaces'
      case 'move3':
        return 'Move forward 3 spaces'
      case 'backup':
        return 'Move backward 1 space'
      case 'turnLeft':
        return 'Rotate 90° counter-clockwise'
      case 'turnRight':
        return 'Rotate 90° clockwise'
      case 'uTurn':
        return 'Rotate 180°'
      default:
        return ''
    }
  }

  const getCardColor = (type: CardType): string => {
    switch (type) {
      case 'move1':
      case 'move2':
      case 'move3':
        return '#4caf50' // Green for movement
      case 'backup':
        return '#ff9800' // Orange for backup
      case 'turnLeft':
      case 'turnRight':
        return '#2196f3' // Blue for turns
      case 'uTurn':
        return '#9c27b0' // Purple for U-turn
      default:
        return '#757575'
    }
  }

  return (
    <Tooltip title={getCardDescription(card.type)} placement="top">
      <Card
        onClick={onClick}
        sx={{
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          minWidth: 120,
          minHeight: 140,
          bgcolor: isSelected ? 'primary.light' : 'background.paper',
          border: isSelected ? 2 : 1,
          borderColor: isSelected ? 'primary.main' : 'divider',
          opacity: isDisabled ? 0.5 : 1,
          transform: isSelected ? 'scale(1.05)' : 'scale(1)',
          transition: 'all 0.2s ease',
          '&:hover': {
            transform: isDisabled ? 'scale(1)' : 'scale(1.02)',
            boxShadow: isDisabled ? 'none' : 2,
          },
        }}
      >
        <CardContent sx={{ textAlign: 'center', pb: 1 }}>
          <Box
            sx={{
              fontSize: '2rem',
              color: getCardColor(card.type),
              mb: 1,
            }}
          >
            {getCardIcon(card.type)}
          </Box>
          <Typography variant="h6" component="div" sx={{ fontSize: '0.9rem' }}>
            {getCardName(card.type)}
          </Typography>
          {showPriority && (
            <Chip
              label={`Priority: ${card.priority}`}
              size="small"
              sx={{ mt: 1 }}
            />
          )}
        </CardContent>
      </Card>
    </Tooltip>
  )
}

interface ProgrammingSlotProps {
  register: number
  card?: GameCard
  onCardRemove: () => void
  isEmpty: boolean
}

const ProgrammingSlot: React.FC<ProgrammingSlotProps> = ({ 
  register, 
  card, 
  onCardRemove, 
  isEmpty 
}) => {
  return (
    <Paper
      sx={{
        minWidth: 120,
        minHeight: 140,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        border: 2,
        borderStyle: 'dashed',
        borderColor: isEmpty ? 'divider' : 'primary.main',
        bgcolor: isEmpty ? 'action.hover' : 'background.paper',
        position: 'relative',
      }}
    >
      <Typography variant="caption" sx={{ position: 'absolute', top: 4, left: 4 }}>
        Register {register}
      </Typography>
      
      {card ? (
        <Box sx={{ textAlign: 'center', width: '100%' }}>
          <CardComponent
            card={card}
            isSelected={false}
            onClick={onCardRemove}
            showPriority
          />
        </Box>
      ) : (
        <Box sx={{ textAlign: 'center', color: 'text.secondary' }}>
          <Typography variant="body2">
            Drag card here
          </Typography>
        </Box>
      )}
    </Paper>
  )
}

interface CardHandProps {
  hand: GameCard[]
  selectedCards: GameCard[]
  maxCards?: number
  onCardSelect: (card: GameCard) => void
  onCardDeselect: (card: GameCard) => void
  onCardsSubmit: () => void
  onCardsClear: () => void
  readonly?: boolean
  showSubmitButton?: boolean
}

const CardHand: React.FC<CardHandProps> = ({
  hand,
  selectedCards,
  maxCards = 5,
  onCardSelect,
  onCardDeselect,
  onCardsSubmit,
  onCardsClear,
  readonly = false,
  showSubmitButton = true,
}) => {
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false)

  const handleCardClick = (card: GameCard) => {
    if (readonly) return

    const isSelected = selectedCards.some(selected => selected.id === card.id)
    
    if (isSelected) {
      onCardDeselect(card)
    } else if (selectedCards.length < maxCards) {
      onCardSelect(card)
    }
  }

  const handleSubmit = () => {
    if (selectedCards.length === maxCards) {
      setConfirmSubmitOpen(true)
    }
  }

  const confirmSubmit = () => {
    setConfirmSubmitOpen(false)
    onCardsSubmit()
  }

  const isCardSelected = (card: GameCard): boolean => {
    return selectedCards.some(selected => selected.id === card.id)
  }

  const isCardDisabled = (card: GameCard): boolean => {
    return selectedCards.length >= maxCards && !isCardSelected(card)
  }

  const canSubmit = selectedCards.length === maxCards && !readonly

  return (
    <Box>
      {/* Programming Registers */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Programming Registers
        </Typography>
        <Grid container spacing={1} justifyContent="center">
          {Array.from({ length: maxCards }, (_, index) => {
            const register = index + 1
            const card = selectedCards[index]
            return (
              <Grid item key={register}>
                <ProgrammingSlot
                  register={register}
                  card={card}
                  onCardRemove={() => card && onCardDeselect(card)}
                  isEmpty={!card}
                />
              </Grid>
            )
          })}
        </Grid>
        
        {/* Progress indicator */}
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Chip
            label={`${selectedCards.length}/${maxCards} cards selected`}
            color={selectedCards.length === maxCards ? 'success' : 'default'}
            variant={selectedCards.length === maxCards ? 'filled' : 'outlined'}
          />
        </Box>
      </Box>

      {/* Action buttons */}
      {!readonly && (
        <Box sx={{ mb: 3, display: 'flex', gap: 2, justifyContent: 'center' }}>
          <Button
            variant="outlined"
            startIcon={<Clear />}
            onClick={onCardsClear}
            disabled={selectedCards.length === 0}
          >
            Clear All
          </Button>
          {showSubmitButton && (
            <Button
              variant="contained"
              startIcon={<PlayArrow />}
              onClick={handleSubmit}
              disabled={!canSubmit}
              color="success"
            >
              Submit Turn
            </Button>
          )}
        </Box>
      )}

      {/* Hand of cards */}
      <Box>
        <Typography variant="h6" gutterBottom>
          Your Hand
        </Typography>
        <Grid container spacing={2} justifyContent="center">
          {hand.map((card) => (
            <Grid item key={card.id}>
              <CardComponent
                card={card}
                isSelected={isCardSelected(card)}
                isDisabled={isCardDisabled(card)}
                onClick={() => handleCardClick(card)}
              />
            </Grid>
          ))}
        </Grid>
        
        {hand.length === 0 && (
          <Alert severity="info" sx={{ mt: 2 }}>
            No cards in hand. Wait for the next turn to receive new cards.
          </Alert>
        )}
      </Box>

      {/* Confirmation dialog */}
      <Dialog open={confirmSubmitOpen} onClose={() => setConfirmSubmitOpen(false)}>
        <DialogTitle>Submit Turn</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to submit your programmed cards? This action cannot be undone.
          </Typography>
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Your programmed sequence:
            </Typography>
            <Grid container spacing={1}>
              {selectedCards.map((card, index) => (
                <Grid item key={`confirm-${card.id}`}>
                  <Chip
                    label={`${index + 1}. ${card.type}`}
                    size="small"
                    variant="outlined"
                  />
                </Grid>
              ))}
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmSubmitOpen(false)}>Cancel</Button>
          <Button onClick={confirmSubmit} variant="contained" color="success">
            Confirm Submit
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default CardHand