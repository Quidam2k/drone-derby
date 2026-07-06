import { test, expect } from './fixtures/auth'

test.describe('Game Interface', () => {
  test.beforeEach(async ({ page, loginAsValidUser }) => {
    await loginAsValidUser()
  })

  test('should display game page with mock data', async ({ page }) => {
    // Navigate to a mock game
    await page.goto('/games/mock-game-id')
    
    await expect(page).toHaveTitle(/Game/i)
    await expect(page.locator('[data-testid="game-board"]')).toBeVisible()
    await expect(page.locator('[data-testid="game-status"]')).toBeVisible()
    await expect(page.locator('[data-testid="card-hand"]')).toBeVisible()
  })

  test('should show game status and player information', async ({ page }) => {
    await page.goto('/games/mock-game-id')
    
    await expect(page.locator('[data-testid="current-turn"]')).toContainText('Turn 1')
    await expect(page.locator('[data-testid="game-phase"]')).toContainText(/programming/i)
    await expect(page.locator('[data-testid="player-list"]')).toBeVisible()
    await expect(page.locator('[data-testid="player-progress"]')).toBeVisible()
  })

  test('should display card hand with movement cards', async ({ page }) => {
    await page.goto('/games/mock-game-id')
    
    const cardHand = page.locator('[data-testid="card-hand"]')
    await expect(cardHand).toBeVisible()
    
    // Should show programming registers
    await expect(page.locator('[data-testid="programming-registers"]')).toBeVisible()
    
    // Should show hand of cards
    await expect(page.locator('[data-testid="hand-cards"]')).toBeVisible()
    await expect(page.locator('[data-testid="card-move1"]')).toBeVisible()
    await expect(page.locator('[data-testid="card-move2"]')).toBeVisible()
    await expect(page.locator('[data-testid="card-turnLeft"]')).toBeVisible()
  })

  test('should allow card selection and programming', async ({ page }) => {
    await page.goto('/games/mock-game-id')
    
    // Select cards for programming
    await page.click('[data-testid="card-move1"]')
    await page.click('[data-testid="card-turnRight"]')
    await page.click('[data-testid="card-move2"]')
    await page.click('[data-testid="card-turnLeft"]')
    await page.click('[data-testid="card-move3"]')
    
    // Should show cards in programming registers
    await expect(page.locator('[data-testid="register-1"]')).toContainText('Move 1')
    await expect(page.locator('[data-testid="register-2"]')).toContainText('Turn Right')
    
    // Should show progress indicator
    await expect(page.locator('[data-testid="cards-selected-count"]')).toContainText('5/5')
    
    // Submit button should be enabled
    await expect(page.locator('[data-testid="submit-turn-button"]')).toBeEnabled()
  })

  test('should handle card deselection', async ({ page }) => {
    await page.goto('/games/mock-game-id')
    
    // Select some cards
    await page.click('[data-testid="card-move1"]')
    await page.click('[data-testid="card-move2"]')
    
    // Click on programmed card to deselect
    await page.click('[data-testid="register-1"] [data-testid="card-move1"]')
    
    // Should remove from register and update count
    await expect(page.locator('[data-testid="register-1"]')).not.toContainText('Move 1')
    await expect(page.locator('[data-testid="cards-selected-count"]')).toContainText('1/5')
  })

  test('should clear all selected cards', async ({ page }) => {
    await page.goto('/games/mock-game-id')
    
    // Select some cards
    await page.click('[data-testid="card-move1"]')
    await page.click('[data-testid="card-move2"]')
    await page.click('[data-testid="card-turnLeft"]')
    
    // Clear all
    await page.click('[data-testid="clear-all-button"]')
    
    // All registers should be empty
    await expect(page.locator('[data-testid="register-1"]')).toContainText('Drag card here')
    await expect(page.locator('[data-testid="cards-selected-count"]')).toContainText('0/5')
  })

  test('should show turn submission confirmation', async ({ page }) => {
    await page.goto('/games/mock-game-id')
    
    // Select 5 cards
    await page.click('[data-testid="card-move1"]')
    await page.click('[data-testid="card-move2"]')
    await page.click('[data-testid="card-move3"]')
    await page.click('[data-testid="card-turnLeft"]')
    await page.click('[data-testid="card-turnRight"]')
    
    // Click submit
    await page.click('[data-testid="submit-turn-button"]')
    
    // Should show confirmation dialog
    await expect(page.locator('[role="dialog"]')).toContainText('Submit Turn')
    await expect(page.locator('[data-testid="programmed-sequence"]')).toBeVisible()
    
    // Cancel submission
    await page.click('[data-testid="cancel-submit"]')
    await expect(page.locator('[role="dialog"]')).not.toBeVisible()
  })

  test('should display game board with robots and tiles', async ({ page }) => {
    await page.goto('/games/mock-game-id')
    
    const gameBoard = page.locator('[data-testid="game-board"]')
    await expect(gameBoard).toBeVisible()
    
    // Should show board tiles
    await expect(gameBoard.locator('[data-testid="board-canvas"]')).toBeVisible()
    
    // Should show robots
    await expect(gameBoard.locator('[data-testid="robot-player1"]')).toBeVisible()
    
    // Should show checkpoints and start positions
    await expect(gameBoard.locator('[data-testid="checkpoint-1"]')).toBeVisible()
    await expect(gameBoard.locator('[data-testid="start-position"]')).toBeVisible()
  })

  test('should show help dialog when help button is clicked', async ({ page }) => {
    await page.goto('/games/mock-game-id')
    
    await page.click('[data-testid="help-button"]')
    
    const helpDialog = page.locator('[role="dialog"]')
    await expect(helpDialog).toContainText('How to Play')
    await expect(helpDialog).toContainText('Objective')
    await expect(helpDialog).toContainText('Programming Phase')
    await expect(helpDialog).toContainText('Card Types')
    
    await page.click('[data-testid="close-help"]')
    await expect(helpDialog).not.toBeVisible()
  })

  test('should show leave game confirmation', async ({ page }) => {
    await page.goto('/games/mock-game-id')
    
    await page.click('[data-testid="leave-game-button"]')
    
    const leaveDialog = page.locator('[role="dialog"]')
    await expect(leaveDialog).toContainText('Leave Game')
    await expect(leaveDialog).toContainText('not be able to rejoin')
    
    // Cancel leaving
    await page.click('[data-testid="cancel-leave"]')
    await expect(leaveDialog).not.toBeVisible()
    await expect(page).toHaveURL('/games/mock-game-id')
  })

  test('should display player status and ready indicators', async ({ page }) => {
    await page.goto('/games/mock-game-id')
    
    const gameStatus = page.locator('[data-testid="game-status"]')
    
    // Should show player list
    await expect(gameStatus.locator('[data-testid="player-list"]')).toBeVisible()
    
    // Should show current player indicator
    await expect(gameStatus.locator('[data-testid="current-player-indicator"]')).toBeVisible()
    
    // Should show ready status
    await expect(gameStatus.locator('[data-testid="player-ready-status"]')).toBeVisible()
  })

  test('should show turn progress when players submit', async ({ page }) => {
    await page.goto('/games/mock-game-id')
    
    // Should show turn progress bar
    await expect(page.locator('[data-testid="turn-progress"]')).toBeVisible()
    await expect(page.locator('[data-testid="players-ready-count"]')).toContainText('0/2')
  })

  test('should display checkpoint progress for each player', async ({ page }) => {
    await page.goto('/games/mock-game-id')
    
    const playerList = page.locator('[data-testid="player-list"]')
    
    // Should show checkpoint indicators
    await expect(playerList.locator('[data-testid="checkpoint-progress"]')).toBeVisible()
    await expect(playerList.locator('[data-testid="checkpoints-reached"]')).toBeVisible()
  })

  test('should handle card tooltips and descriptions', async ({ page }) => {
    await page.goto('/games/mock-game-id')
    
    // Hover over a movement card
    await page.hover('[data-testid="card-move1"]')
    
    // Should show tooltip with card description
    await expect(page.locator('[role="tooltip"]')).toContainText('Move forward 1 space')
    
    // Hover over turn card
    await page.hover('[data-testid="card-turnLeft"]')
    await expect(page.locator('[role="tooltip"]')).toContainText('Rotate 90° counter-clockwise')
  })

  test('should disable card selection when max cards selected', async ({ page }) => {
    await page.goto('/games/mock-game-id')
    
    // Select 5 cards (maximum)
    await page.click('[data-testid="card-move1"]')
    await page.click('[data-testid="card-move2"]')
    await page.click('[data-testid="card-move3"]')
    await page.click('[data-testid="card-turnLeft"]')
    await page.click('[data-testid="card-turnRight"]')
    
    // Additional cards should be disabled
    await expect(page.locator('[data-testid="card-backup"]')).toHaveClass(/disabled/)
    await expect(page.locator('[data-testid="card-uTurn"]')).toHaveClass(/disabled/)
  })

  test('should show game settings and board info', async ({ page }) => {
    await page.goto('/games/mock-game-id')
    
    const gameStatus = page.locator('[data-testid="game-status"]')
    
    // Should show game settings
    await expect(gameStatus.locator('[data-testid="max-players"]')).toContainText('Max Players: 4')
    await expect(gameStatus.locator('[data-testid="board-name"]')).toContainText('Board: Test Board')
  })
})