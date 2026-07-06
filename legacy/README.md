# Drone Derby

A web-based asynchronous multiplayer programming game inspired by RoboRally mechanics with original theme and artwork.

## 🎮 Game Overview

Drone Derby is a strategic programming game where 2-4 players command robots on a grid-based board. Players program their robots with movement cards, which execute simultaneously in priority order. The first player to reach all checkpoints in sequence wins!

### Key Features

- **Asynchronous Multiplayer**: Players can program their moves at any time
- **Programming-Based Gameplay**: Use movement cards to control your robot
- **Level Editor**: Create and share custom boards with drag-and-drop interface
- **Real-time Notifications**: Stay updated on game progress
- **Cross-Platform**: Works on desktop, tablet, and mobile devices

## 🚀 Quick Start

### Prerequisites

- Node.js 18.0.0 or higher
- npm 8.0.0 or higher
- Docker and Docker Compose (optional)

### Development Setup

1. **Clone and install:**
   ```bash
   git clone https://github.com/your-org/drone-derby.git
   cd drone-derby
   npm run setup
   ```

2. **Start database services:**
   ```bash
   npm run docker:up
   ```

3. **Run database migrations:**
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

4. **Start development servers:**
   ```bash
   npm run dev
   ```

5. **Open the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001

### Production Build

```bash
npm run build
npm start
```

## 📁 Project Structure

```
drone-derby/
├── client/              # React frontend application
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── pages/       # Page components
│   │   ├── hooks/       # Custom React hooks
│   │   ├── services/    # API and WebSocket services
│   │   ├── store/       # Redux store and slices
│   │   ├── types/       # TypeScript type definitions
│   │   └── utils/       # Utility functions
│   └── public/          # Static assets
├── server/              # Node.js backend API
│   ├── src/
│   │   ├── controllers/ # Route handlers
│   │   ├── middleware/  # Express middleware
│   │   ├── models/      # Database models
│   │   ├── routes/      # API route definitions
│   │   ├── services/    # Business logic services
│   │   ├── socket/      # WebSocket event handlers
│   │   └── utils/       # Utility functions
│   └── database/        # Database migrations and seeds
├── shared/              # Shared types and utilities
└── docs/                # Project documentation
```

## 🛠️ Available Scripts

### Root Commands
- `npm run dev` - Start both client and server in development mode
- `npm run build` - Build both client and server for production
- `npm run test` - Run all tests
- `npm run lint` - Lint all code
- `npm run typecheck` - Run TypeScript type checking

### Database Commands
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed database with sample data

### Docker Commands
- `npm run docker:up` - Start database services
- `npm run docker:down` - Stop database services

## 🎯 Game Rules

### Objective
Be the first robot to reach all numbered checkpoints in sequence (1, 2, 3, etc.).

### Turn Structure
1. **Programming Phase**: Each player selects 5 movement cards from their hand
2. **Execution Phase**: Cards execute simultaneously in priority order (register 1-5)
3. **Board Effects**: Conveyor belts activate after robot movements
4. **Next Turn**: Draw new cards and repeat

### Movement Cards
- **Move 1-3**: Move forward 1-3 spaces
- **Back Up**: Move backward 1 space
- **Turn Left/Right**: Rotate 90 degrees
- **U-Turn**: Rotate 180 degrees

### Board Elements
- **Floor**: Standard movement space
- **Wall**: Blocks movement
- **Conveyor Belt**: Moves robots after each register
- **Checkpoint**: Numbered objectives to reach in order
- **Start Position**: Robot spawn points

## 🔧 Development

### Code Style
We use ESLint and Prettier for code formatting. Run `npm run lint` to check for issues.

### Testing
- Unit tests: Jest
- Integration tests: Supertest (backend), React Testing Library (frontend)
- E2E tests: Playwright

### Database
- PostgreSQL for persistent data
- Redis for session management and real-time game state
- Migrations handled by Knex.js

## 📖 API Documentation

The API documentation is available at `/api/docs` when running the development server.

Key endpoint categories:
- `/api/auth` - Authentication and user management
- `/api/games` - Game creation and management
- `/api/boards` - Level editor and board management
- `/api/templates` - Board template system

## 🔌 WebSocket Events

Real-time events for multiplayer functionality:
- `game_updated` - Game state changes
- `turn_ready` - All players have submitted
- `execution_complete` - Turn results available
- `player_joined` - New player entered game
- `player_left` - Player left game

## 🚀 Deployment

### Environment Variables

**Server (.env):**
```env
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://user:password@localhost:5432/drone_derby
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secure-jwt-secret
CORS_ORIGIN=https://yourdomain.com
```

**Client (.env):**
```env
REACT_APP_API_URL=https://api.yourdomain.com
REACT_APP_WS_URL=wss://api.yourdomain.com
```

### Docker Deployment

1. Build images:
   ```bash
   docker-compose -f docker-compose.prod.yml build
   ```

2. Start services:
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by the classic board game RoboRally
- Built with modern web technologies
- Designed for accessibility and cross-platform compatibility