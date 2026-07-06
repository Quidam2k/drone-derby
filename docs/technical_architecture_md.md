# Technical Architecture

> **⚠️ STALE — v1 document, kept as history.** This describes the archived
> legacy stack (`legacy/`). The v2 architecture is Vite + React + Convex;
> see `CLAUDE.md` and `cascades/2026-07-05-v2-rewrite.md`.

## Technology Stack

### Frontend
- **Framework**: React or Vue.js
- **Rendering**: HTML5 Canvas or SVG for game board
- **State Management**: Redux/Vuex for game state
- **Styling**: CSS Grid/Flexbox with SCSS
- **Real-time**: WebSocket client for notifications

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL for persistent data
- **Session Store**: Redis for game state
- **Real-time**: Socket.io for notifications
- **Authentication**: JWT tokens

## System Architecture

### Asynchronous Game Flow
1. **Game Creation**: Host creates game room with unique ID
2. **Player Joining**: Players join via game code/link
3. **Card Programming**: Players program cards independently
4. **Auto Execution**: Game executes when all players submit
5. **Result Distribution**: All players receive execution results
6. **Next Turn**: Cycle repeats until win condition

### Data Models

#### Game State
```javascript
{
  gameId: string,
  players: [Player],
  board: Board,
  currentTurn: number,
  phase: 'programming' | 'executing' | 'complete',
  turnSubmissions: Map<playerId, [Card]>,
  createdAt: Date,
  lastActivity: Date
}
```

#### Player
```javascript
{
  id: string,
  name: string,
  robot: {
    position: {x: number, y: number}, 
    facing: 'north'|'south'|'east'|'west'
  },
  checkpointsReached: number[],
  isReady: boolean,
  lastSeen: Date
}
```

#### Board
```javascript
{
  id: string,
  name: string,
  size: {width: 10, height: 10},
  tiles: Tile[][],
  checkpoints: [{id: number, position: {x: number, y: number}}],
  startPositions: [{x: number, y: number}],
  createdBy: string,
  isPublic: boolean
}
```

#### Card
```javascript
{
  id: string,
  type: 'move1'|'move2'|'move3'|'backup'|'turnLeft'|'turnRight'|'uTurn',
  priority: number,
  register: number (1-5)
}
```

#### Tile
```javascript
{
  type: 'floor'|'wall'|'conveyorNormal'|'conveyorFast'|'checkpoint'|'start',
  direction?: 'north'|'south'|'east'|'west', // for conveyor belts
  checkpointNumber?: number // for checkpoint tiles
}
```

## API Endpoints

### Game Management
- `POST /api/games` - Create new game
- `GET /api/games/:id` - Get game state
- `POST /api/games/:id/join` - Join game
- `POST /api/games/:id/program` - Submit card programming
- `GET /api/games/:id/results` - Get execution results
- `POST /api/games/:id/leave` - Leave game

### Level Editor
- `GET /api/boards` - List available boards
- `POST /api/boards` - Create new board
- `PUT /api/boards/:id` - Update board
- `DELETE /api/boards/:id` - Delete board
- `GET /api/boards/:id` - Get specific board
- `GET /api/templates` - List templates
- `POST /api/templates` - Save template

### User Management
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login
- `GET /api/users/profile` - Get user profile
- `GET /api/users/games` - Get user's games

### Real-time Events (WebSocket)
- `game_updated` - Game state changed
- `turn_ready` - All players submitted
- `execution_complete` - Turn results available
- `player_joined` - New player entered game
- `player_left` - Player left game
- `notification` - General notifications

## Database Schema

### Tables
1. **users** - User accounts and profiles
2. **games** - Game instances and metadata
3. **game_players** - Player participation in games
4. **boards** - Custom board layouts
5. **templates** - Saved board templates
6. **game_turns** - Historical turn data
7. **notifications** - User notifications

### Redis Storage
- **Game State**: Active game data with TTL
- **Player Sessions**: Online player tracking
- **Turn Submissions**: Temporary storage for card submissions
- **Lobbies**: Game rooms waiting for players

## Asynchronous Implementation

### Turn Management
```javascript
// When player submits turn
async function submitTurn(gameId, playerId, cards) {
  // Store submission in Redis
  await redis.hset(`game:${gameId}:submissions`, playerId, JSON.stringify(cards));
  
  // Check if all players submitted
  const submissions = await redis.hgetall(`game:${gameId}:submissions`);
  const game = await getGame(gameId);
  
  if (Object.keys(submissions).length === game.players.length) {
    // Execute turn
    await executeTurn(gameId, submissions);
    // Clear submissions
    await redis.del(`game:${gameId}:submissions`);
    // Notify all players
    io.to(gameId).emit('turn_executed');
  }
}
```

### Notification System
- **Email**: For turn completion when player offline
- **Push Notifications**: Browser notifications for web app
- **In-App**: Real-time notifications when online
- **SMS**: Optional for critical game events

## Level Editor Architecture

### Editor State Management
```javascript
{
  board: Tile[][],
  selectedTile: TileType,
  selectedArea: {startX, startY, endX, endY},
  mode: 'place'|'paint'|'select'|'delete',
  templates: Template[],
  history: BoardState[], // for undo/redo
  isDirty: boolean
}
```

### Template System
- **Creation**: Select area, name template, save
- **Storage**: Database + file storage for images
- **Preview**: Generate thumbnail on save
- **Sharing**: Public/private templates with ratings

### Validation Engine
```javascript
function validateBoard(board) {
  const issues = [];
  
  // Check required elements
  if (getStartPositions(board).length < 2) {
    issues.push('Need at least 2 start positions');
  }
  
  if (getCheckpoints(board).length < 1) {
    issues.push('Need at least 1 checkpoint');
  }
  
  // Check connectivity
  if (!areAllAreasReachable(board)) {
    issues.push('Some areas are unreachable');
  }
  
  return issues;
}
```

## Performance Considerations

### Frontend Optimization
- **Canvas Rendering**: Efficient redraw only for changed tiles
- **State Updates**: Immutable state with selective re-renders
- **Asset Loading**: Preload sprites and compress images
- **Mobile Performance**: Touch-optimized interactions

### Backend Scaling
- **Database Indexing**: Optimize queries for game lookup
- **Redis Clustering**: Horizontal scaling for session data
- **CDN**: Static assets and board images
- **Load Balancing**: Multiple server instances

## Security Measures

### Authentication
- **JWT Tokens**: Secure API access
- **Rate Limiting**: Prevent API abuse
- **Input Validation**: Sanitize all user input
- **CORS**: Proper cross-origin policies

### Game Integrity
- **Server Validation**: All moves validated server-side
- **Anti-Cheating**: Timestamp validation for submissions
- **Data Encryption**: Sensitive game data encrypted
- **Audit Logging**: Track all game actions