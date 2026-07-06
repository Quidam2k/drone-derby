import { test, expect } from './fixtures/auth'
import { LevelEditorPage } from './pages/LevelEditorPage'

test.describe('Level Editor', () => {
  let editorPage: LevelEditorPage

  test.beforeEach(async ({ page, loginAsValidUser }) => {
    await loginAsValidUser()
    editorPage = new LevelEditorPage(page)
    await editorPage.goto()
    await editorPage.waitForCanvasToLoad()
  })

  test('should display level editor interface correctly', async ({ page }) => {
    await expect(page).toHaveTitle(/Level Editor/i)
    await expect(editorPage.canvas).toBeVisible()
    await expect(editorPage.tilePalette).toBeVisible()
    await expect(editorPage.propertiesPanel).toBeVisible()
    await expect(editorPage.toolbar).toBeVisible()
  })

  test('should create a new board', async ({ page }) => {
    await editorPage.newBoardButton.click()
    
    // Should confirm if there are unsaved changes
    // For a new session, it should create immediately
    await editorPage.waitForCanvasToLoad()
    
    const overview = await editorPage.getBoardOverview()
    expect(overview.startPositions).toBe(0)
    expect(overview.checkpoints).toBe(0)
  })

  test('should place different tile types on the board', async ({ page }) => {
    // Test placing floor tiles
    await editorPage.selectTile('floor')
    await editorPage.placeTileAt(1, 1)
    
    // Test placing wall tiles
    await editorPage.selectTile('wall')
    await editorPage.placeTileAt(2, 2)
    
    // Test placing start position
    await editorPage.selectTile('start')
    await editorPage.placeTileAt(0, 0)
    
    // Test placing checkpoint
    await editorPage.selectTile('checkpoint')
    await editorPage.placeTileAt(5, 5)
    
    // Verify board overview updates
    const overview = await editorPage.getBoardOverview()
    expect(overview.startPositions).toBe(1)
    expect(overview.checkpoints).toBe(1)
  })

  test('should drag and drop tiles from palette to canvas', async ({ page }) => {
    await editorPage.dragTileToCanvas('wall', 3, 3)
    await editorPage.dragTileToCanvas('start', 0, 0)
    await editorPage.dragTileToCanvas('checkpoint', 9, 9)
    
    const overview = await editorPage.getBoardOverview()
    expect(overview.startPositions).toBe(1)
    expect(overview.checkpoints).toBe(1)
  })

  test('should select and modify tile properties', async ({ page }) => {
    // Place a conveyor belt
    await editorPage.selectTile('conveyorNormal')
    await editorPage.placeTileAt(4, 4)
    
    // Click on the placed tile to select it
    await editorPage.clickTileAt(4, 4)
    
    // Verify tile is selected and properties are shown
    const properties = await editorPage.getTileProperties()
    expect(properties.tileType).toContain('conveyorNormal')
    expect(properties.position).toContain('(4, 4)')
    
    // Change conveyor direction
    await editorPage.setConveyorDirection('east')
    
    // Properties should update
    // Could check for visual changes on the canvas
  })

  test('should validate board and show issues', async ({ page }) => {
    // Create an invalid board (no start positions)
    await editorPage.selectTile('checkpoint')
    await editorPage.placeTileAt(5, 5)
    
    const isValid = await editorPage.getValidationStatus()
    expect(isValid).toBe(false)
    
    const issues = await editorPage.getValidationIssues()
    expect(issues).toContain(/start position/i)
  })

  test('should create a valid board and pass validation', async ({ page }) => {
    // Create a minimal valid board
    await editorPage.selectTile('start')
    await editorPage.placeTileAt(0, 0)
    await editorPage.placeTileAt(9, 0)
    
    await editorPage.selectTile('checkpoint')
    await editorPage.placeTileAt(5, 5)
    
    const isValid = await editorPage.getValidationStatus()
    expect(isValid).toBe(true)
    
    const issues = await editorPage.getValidationIssues()
    expect(issues).toHaveLength(0)
  })

  test('should save a board with metadata', async ({ page }) => {
    // Create a basic board
    await editorPage.selectTile('start')
    await editorPage.placeTileAt(0, 0)
    
    await editorPage.selectTile('checkpoint')
    await editorPage.placeTileAt(5, 5)
    
    // Save the board
    const boardName = `Test Board ${Date.now()}`
    const boardDescription = 'A test board created by automated tests'
    
    await editorPage.saveBoard(boardName, boardDescription, true)
    
    // Should show success indication
    await expect(page.locator('[data-testid="save-success"]')).toBeVisible()
  })

  test('should export board as JSON', async ({ page }) => {
    // Create a simple board
    await editorPage.selectTile('start')
    await editorPage.placeTileAt(0, 0)
    
    const download = await editorPage.exportBoard()
    
    expect(download.suggestedFilename()).toMatch(/\.json$/)
    
    // Verify the downloaded file content
    const path = await download.path()
    expect(path).toBeTruthy()
  })

  test('should clear the entire board', async ({ page }) => {
    // Place some tiles
    await editorPage.selectTile('wall')
    await editorPage.placeTileAt(1, 1)
    await editorPage.placeTileAt(2, 2)
    
    await editorPage.selectTile('start')
    await editorPage.placeTileAt(0, 0)
    
    // Clear the board
    await editorPage.clearBoard()
    
    // Board should be empty
    const overview = await editorPage.getBoardOverview()
    expect(overview.startPositions).toBe(0)
    expect(overview.checkpoints).toBe(0)
  })

  test('should handle multiple start positions correctly', async ({ page }) => {
    // Place multiple start positions
    await editorPage.selectTile('start')
    await editorPage.placeTileAt(0, 0)
    await editorPage.placeTileAt(9, 0)
    await editorPage.placeTileAt(0, 9)
    await editorPage.placeTileAt(9, 9)
    
    const overview = await editorPage.getBoardOverview()
    expect(overview.startPositions).toBe(4)
    
    // Adding a 5th should show a validation warning
    await editorPage.placeTileAt(5, 5)
    
    const issues = await editorPage.getValidationIssues()
    expect(issues).toContain(/maximum.*4.*start/i)
  })

  test('should handle conveyor belt placement and directions', async ({ page }) => {
    // Test normal conveyor
    await editorPage.selectTile('conveyorNormal')
    await editorPage.placeTileAt(2, 2)
    
    // Test fast conveyor
    await editorPage.selectTile('conveyorFast')
    await editorPage.placeTileAt(3, 3)
    
    // Select and modify direction
    await editorPage.clickTileAt(2, 2)
    await editorPage.setConveyorDirection('south')
    
    // Visual verification would require more complex assertions
    // For now, ensure no errors occur
    await expect(editorPage.propertiesPanel).toBeVisible()
  })

  test('should validate checkpoint numbering', async ({ page }) => {
    // Place checkpoints in wrong order
    await editorPage.selectTile('checkpoint')
    await editorPage.placeTileAt(5, 5) // This should become checkpoint 1
    await editorPage.placeTileAt(6, 6) // This should become checkpoint 2
    
    // Add start position to make board valid otherwise
    await editorPage.selectTile('start')
    await editorPage.placeTileAt(0, 0)
    
    const isValid = await editorPage.getValidationStatus()
    expect(isValid).toBe(true) // Should be valid with sequential checkpoints
    
    const overview = await editorPage.getBoardOverview()
    expect(overview.checkpoints).toBe(2)
  })

  test('should switch between properties and validation tabs', async ({ page }) => {
    // Place a tile and select it
    await editorPage.selectTile('wall')
    await editorPage.placeTileAt(3, 3)
    await editorPage.clickTileAt(3, 3)
    
    // Should show properties tab by default
    await expect(page.locator('[data-testid="properties-tab"]')).toHaveAttribute('aria-selected', 'true')
    
    // Switch to validation tab
    await page.click('[data-testid="validation-tab"]')
    await expect(page.locator('[data-testid="validation-tab"]')).toHaveAttribute('aria-selected', 'true')
    await expect(editorPage.validationPanel).toBeVisible()
  })

  test('should handle unsaved changes warning', async ({ page }) => {
    // Make some changes
    await editorPage.selectTile('wall')
    await editorPage.placeTileAt(1, 1)
    
    // Try to navigate away
    await page.click('[data-testid="back-to-boards"]')
    
    // Should show confirmation dialog
    await expect(page.locator('[role="dialog"]')).toContainText(/unsaved changes/i)
    
    // Cancel and stay on editor
    await page.click('[data-testid="cancel-navigation"]')
    await expect(page).toHaveURL('/editor')
  })

  test('should show tile statistics in properties panel', async ({ page }) => {
    // Place various tiles
    await editorPage.selectTile('floor')
    await editorPage.placeTileAt(1, 1)
    await editorPage.placeTileAt(2, 2)
    
    await editorPage.selectTile('wall')
    await editorPage.placeTileAt(3, 3)
    
    await editorPage.selectTile('start')
    await editorPage.placeTileAt(0, 0)
    
    // Check tile statistics
    await expect(page.locator('[data-testid="tile-stats"]')).toBeVisible()
    await expect(page.locator('text=floor: 2')).toBeVisible()
    await expect(page.locator('text=wall: 1')).toBeVisible()
    await expect(page.locator('text=start: 1')).toBeVisible()
  })
})