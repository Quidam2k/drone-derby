import { Page, Locator, expect } from '@playwright/test'

export class LevelEditorPage {
  readonly page: Page
  readonly canvas: Locator
  readonly tilePalette: Locator
  readonly propertiesPanel: Locator
  readonly validationPanel: Locator
  readonly toolbar: Locator
  readonly saveButton: Locator
  readonly newBoardButton: Locator
  readonly clearBoardButton: Locator
  readonly exportButton: Locator
  readonly importButton: Locator

  constructor(page: Page) {
    this.page = page
    this.canvas = page.locator('[data-testid="board-canvas"]')
    this.tilePalette = page.locator('[data-testid="tile-palette"]')
    this.propertiesPanel = page.locator('[data-testid="properties-panel"]')
    this.validationPanel = page.locator('[data-testid="validation-panel"]')
    this.toolbar = page.locator('[data-testid="editor-toolbar"]')
    this.saveButton = page.locator('[data-testid="save-button"]')
    this.newBoardButton = page.locator('[data-testid="new-board-button"]')
    this.clearBoardButton = page.locator('[data-testid="clear-board-button"]')
    this.exportButton = page.locator('[data-testid="export-button"]')
    this.importButton = page.locator('[data-testid="import-button"]')
  }

  async goto() {
    await this.page.goto('/editor')
  }

  async waitForCanvasToLoad() {
    await expect(this.canvas).toBeVisible()
    // Wait for canvas to be interactive
    await this.page.waitForTimeout(1000)
  }

  async selectTile(tileType: string) {
    const tile = this.tilePalette.locator(`[data-testid="tile-${tileType}"]`)
    await tile.click()
  }

  async placeTileAt(x: number, y: number) {
    const TILE_SIZE = 50
    const pixelX = x * TILE_SIZE + TILE_SIZE / 2
    const pixelY = y * TILE_SIZE + TILE_SIZE / 2
    
    await this.canvas.click({ position: { x: pixelX, y: pixelY } })
  }

  async dragTileToCanvas(tileType: string, x: number, y: number) {
    const sourceTile = this.tilePalette.locator(`[data-testid="tile-${tileType}"]`)
    const TILE_SIZE = 50
    const pixelX = x * TILE_SIZE + TILE_SIZE / 2
    const pixelY = y * TILE_SIZE + TILE_SIZE / 2
    
    await sourceTile.dragTo(this.canvas, {
      targetPosition: { x: pixelX, y: pixelY },
    })
  }

  async saveBoard(name: string, description?: string, isPublic?: boolean) {
    await this.saveButton.click()
    
    const dialog = this.page.locator('[role="dialog"]')
    await expect(dialog).toBeVisible()
    
    await dialog.locator('[data-testid="board-name-input"]').fill(name)
    
    if (description) {
      await dialog.locator('[data-testid="board-description-input"]').fill(description)
    }
    
    if (isPublic !== undefined) {
      const toggleSwitch = dialog.locator('[data-testid="public-toggle"]')
      const isCurrentlyChecked = await toggleSwitch.isChecked()
      if (isCurrentlyChecked !== isPublic) {
        await toggleSwitch.click()
      }
    }
    
    await dialog.locator('[data-testid="save-confirm-button"]').click()
    
    // Wait for save to complete
    await expect(dialog).not.toBeVisible()
  }

  async clearBoard() {
    await this.clearBoardButton.click()
    
    // Confirm the clear action
    await this.page.locator('[data-testid="confirm-clear"]').click()
  }

  async exportBoard() {
    // Set up download event listener
    const downloadPromise = this.page.waitForEvent('download')
    
    await this.exportButton.click()
    
    const download = await downloadPromise
    return download
  }

  async importBoard(filePath: string) {
    await this.importButton.click()
    
    // Handle file input
    const fileInput = this.page.locator('input[type="file"]')
    await fileInput.setInputFiles(filePath)
  }

  async getValidationStatus() {
    const validationChip = this.toolbar.locator('[data-testid="validation-chip"]')
    await expect(validationChip).toBeVisible()
    
    const text = await validationChip.textContent()
    return text?.includes('Valid')
  }

  async getValidationIssues() {
    await this.page.locator('[data-testid="validation-tab"]').click()
    
    const issuesList = this.validationPanel.locator('[data-testid="validation-issues"]')
    const issues = await issuesList.locator('li').allTextContents()
    
    return issues
  }

  async clickTileAt(x: number, y: number) {
    const TILE_SIZE = 50
    const pixelX = x * TILE_SIZE + TILE_SIZE / 2
    const pixelY = y * TILE_SIZE + TILE_SIZE / 2
    
    await this.canvas.click({ position: { x: pixelX, y: pixelY } })
  }

  async getTileProperties() {
    const propertiesPanel = this.propertiesPanel
    await expect(propertiesPanel).toBeVisible()
    
    const tileType = await propertiesPanel.locator('[data-testid="selected-tile-type"]').textContent()
    const position = await propertiesPanel.locator('[data-testid="selected-tile-position"]').textContent()
    
    return { tileType, position }
  }

  async setConveyorDirection(direction: 'north' | 'south' | 'east' | 'west') {
    const directionRadio = this.propertiesPanel.locator(`[data-testid="direction-${direction}"]`)
    await directionRadio.click()
  }

  async getBoardOverview() {
    const startPositions = await this.propertiesPanel.locator('[data-testid="start-positions-count"]').textContent()
    const checkpoints = await this.propertiesPanel.locator('[data-testid="checkpoints-count"]').textContent()
    
    return {
      startPositions: parseInt(startPositions || '0'),
      checkpoints: parseInt(checkpoints || '0'),
    }
  }
}