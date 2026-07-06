# Level Editor Specification

## Core Requirements

### Interface Design
- **Grid Display**: 10x10 visible grid with coordinates (A-J, 1-10)
- **Tile Palette**: Sidebar with draggable tile types
- **Template Panel**: Saved templates for reuse
- **Toolbar**: Save, load, clear, validate, test, share buttons
- **Properties Panel**: Configure selected tile properties

### Tile Types (Initial Implementation)
1. **Floor**: Standard movement space (default tile)
2. **Wall**: Blocks movement and line of sight
3. **Conveyor Belt Normal**: Single-speed movement (4 directions)
4. **Conveyor Belt Fast**: Double-speed movement (4 directions)
5. **Checkpoint**: Numbered objectives (1-9)
6. **Start Position**: Robot spawn points (supports 2-4 positions)

### Interaction Modes
- **Place Mode**: Click tile type, click grid position
- **Paint Mode**: Drag to paint multiple tiles with brush
- **Select Mode**: Rectangle selection for copy/move/template creation
- **Delete Mode**: Remove tiles (revert to floor)
- **Rotate Mode**: Change orientation of directional tiles

## Drag-and-Drop System

### Tile Placement
1. **Selection**: Click tile type in palette (highlights active tile)
2. **Placement**: Click grid cell to place tile
3. **Replacement**: Placing tile replaces existing tile
4. **Validation**: Invalid placements show error feedback

### Brush Painting
1. **Activation**: Select paint mode from toolbar
2. **Drag Operation**: Mouse down + drag to paint multiple cells
3. **Visual Feedback**: Preview tiles while dragging
4. **Commit**: Mouse up commits all painted tiles

### Selection Tool
1. **Start Selection**: Click and drag to create rectangle
2. **Visual Indicator**: Dotted border around selected area
3. **Operations**: Copy, cut, paste, delete, create template
4. **Multi-select**: Ctrl+click for multiple selections

## Template System

### Creating Templates
```javascript
// Template creation workflow
1. Use selection tool to mark rectangular area
2. Right-click selection → "Save as Template"
3. Enter template name and description
4. Choose visibility (Private/Public)
5. System generates preview thumbnail
6. Save to template library
```

### Template Properties
```javascript
{
  id: string,
  name: string,
  description: string,
  width: number,
  height: number,
  tiles: TileData[][],
  previewImage: string, // base64 thumbnail
  createdBy: userId,
  isPublic: boolean,
  tags: string[],
  rating: number,
  downloads: number,
  createdAt: Date
}
```

### Using Templates
1. **Browse Library**: Templates organized by category/rating
2. **Preview**: Hover shows enlarged preview
3. **Placement**: Click template, then click grid position
4. **Rotation**: Right-click template for rotation options
5. **Overlap Handling**: New template overwrites existing tiles

### Template Categories
- **Rooms**: Corner rooms, straight halls, chambers
- **Intersections**: T-junctions, crossroads, roundabouts
- **Obstacles**: Maze sections, conveyor patterns
- **Challenges**: Puzzle rooms, trap configurations
- **Decorative**: Border patterns, themed sections

## Validation System

### Required Elements Check
```javascript
function validateBoard(board) {
  const errors = [];
  const warnings = [];
  
  // Critical requirements
  const startPositions = findTiles(board, 'start');
  if (startPositions.length < 2) {
    errors.push('Minimum 2 start positions required');
  }
  if (startPositions.length > 4) {
    errors.push('Maximum 4 start positions allowed');
  }
  
  const checkpoints = findTiles(board, 'checkpoint');
  if (checkpoints.length < 1) {
    errors.push('At least 1 checkpoint required');
  }
  
  // Numbering validation
  const checkpointNumbers = checkpoints.map(cp => cp.number).sort();
  if (!isSequential(checkpointNumbers)) {
    errors.push('Checkpoints must be numbered sequentially (1,2,3...)');
  }
  
  // Reachability analysis
  const unreachableAreas = findUnreachableAreas(board, startPositions);
  if (unreachableAreas.length > 0) {
    warnings.push(`${unreachableAreas.length} areas unreachable from start`);
  }
  
  return { errors, warnings };
}
```

### Quality Analysis
- **Path Length**: Analyze distance between checkpoints
- **Difficulty Balance**: Rate conveyor belt density and complexity
- **Dead Ends**: Identify areas with no escape routes
- **Bottlenecks**: Find narrow passages that may cause congestion
- **Symmetry**: Check for balanced start position advantages

## User Interface Layout

### Main Editor Window
```
┌─────────────────────────────────────────────────────────────────┐
│ File: "Race Track Alpha" [Save] [Load] [Clear] [Validate] [Test] │
├─────────────┬───────────────────────────────┬───────────────────┤
│ Tile Palette│         10x10 Grid            │ Templates         │
│             │                               │                   │
│ 🔲 Floor     │   A B C D E F G H I J         │ 📁 My Templates   │
│ ⬛ Wall      │ 1 . . . . . . . . . .        │ ┌─────┐ Corner    │
│ ➡️ Conveyor  │ 2 . . . . . . . . . .        │ │■ ■ ■│ Room      │
│ ⏩ Fast Belt │ 3 . . . . . . . . . .        │ │. . .│ (3x3)     │
│ ①② Checkpoint│ 4 . . . . . . . . . .        │ │. ①.│           │
│ ⭐ Start Pos │ 5 . . . . . . . . . .        │ └─────┘           │
│             │ 6 . . . . . . . . . .        │                   │
│ Tools:      │ 7 . . . . . . . . . .        │ 📁 Community      │
│ 🖱️ Place     │ 8 . . . . . . . . . .        │ ┌─────┐ Spiral    │
│ 🖌️ Paint     │ 9 . . . . . . . . . .        │ │→ ↓ ←│ Path      │
│ ⬜ Select    │10 . . . . . . . . . .        │ │↑ . ↓│ (4x4)     │
│ 🗑️ Delete    │                               │ │↑ ← ↓│ ⭐⭐⭐      │
│ 🔄 Rotate    │                               │ └─────┘           │
├─────────────┼───────────────────────────────┼───────────────────┤
│ Selection: None     Grid: ✓ Show    Snap: ✓ On                  │
│ Mode: Place         Zoom: 100%      Modified: ✓                 │
└─────────────────────────────────────────────────────────────────┘
```

### Properties Panel (Context-Sensitive)
When checkpoint selected:
```
┌─────────────────┐
│ Checkpoint      │
│ Number: [3] ▼   │
│ ☐ Final Goal    │
│                 │
│ Visual:         │
│ Color: [Yellow] │
│ Size: [Normal]  │
│                 │
│ [Apply] [Reset] │
└─────────────────┘
```

When conveyor belt selected:
```
┌─────────────────┐
│ Conveyor Belt   │
│ Speed: Fast ▼   │
│ Direction: → ▼  │
│                 │
│ Chain Mode:     │
│ ☐ Auto-connect  │
│ ☐ Corner turns  │
│                 │
│ [Apply] [Reset] │
└─────────────────┘
```

## Keyboard Shortcuts

### Tool Selection
- `Q` - Place mode
- `W` - Paint mode  
- `E` - Select mode
- `R` - Rotate mode
- `D` - Delete mode

### Tile Types
- `1` - Floor
- `2` - Wall
- `3` - Conveyor normal
- `4` - Conveyor fast
- `5` - Checkpoint
- `6` - Start position

### Operations
- `Ctrl+S` - Save board
- `Ctrl+O` - Open board
- `Ctrl+Z` - Undo
- `Ctrl+Y` - Redo
- `Ctrl+C` - Copy selection
- `Ctrl+V` - Paste
- `Delete` - Delete selection
- `Space` - Toggle grid display

## Export and Sharing

### Export Formats
1. **JSON**: Complete board data structure
2. **PNG**: Visual board image for sharing
3. **SVG**: Vector format for printing
4. **URL**: Shareable link to play board
5. **QR Code**: Mobile-friendly sharing

### Import Options
1. **File Upload**: Drag-and-drop JSON files
2. **URL Import**: Import from shared board links
3. **Template Import**: Import template collections
4. **Legacy Import**: Support for older formats

### Sharing Features
```javascript
// Share dialog options
{
  shareType: 'public' | 'private' | 'unlisted',
  allowEditing: boolean,
  allowDownload: boolean,
  description: string,
  tags: string[],
  category: string,
  difficulty: 1-5
}
```

## Testing Integration

### Quick Test Mode
1. **AI Simulation**: Add computer-controlled robots
2. **Path Validation**: Verify all checkpoints reachable
3. **Performance Test**: Simulate worst-case scenarios
4. **Balance Analysis**: Check for unfair advantages

### Multiplayer Test
1. **Test Room Creation**: Generate temporary game room
2. **Invite System**: Send test invites to other users
3. **Live Feedback**: Real-time comments during test
4. **Metrics Collection**: Track completion times and paths

### Automated Validation
- **Syntax Check**: Verify board data integrity
- **Playability**: Ensure game can complete
- **Performance**: Check rendering performance
- **Accessibility**: Verify color contrast and navigation