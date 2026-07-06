# Project Requirements

## Overview
Web-based asynchronous multiplayer game inspired by RoboRally mechanics with original theme and artwork.

## Core Features

### Game Type
- **Platform**: Web-based
- **Multiplayer**: 2-4 players, completely asynchronous
- **Gameplay**: Programming-based movement with simultaneous execution

### Key Mechanics
- Players program 5 movement cards per turn
- Cards execute simultaneously in priority order
- Robots interact through pushing and collision
- First to reach all checkpoints in order wins

## Technical Requirements

### Asynchronous Design
- Players can program cards at any time
- Game executes when all players submit
- Results can be viewed live or later
- Notification system for turn completion

### Level Editor
- **Type**: Both admin development tool and player-facing feature
- **Interface**: Drag-and-drop tile system
- **Templates**: Save any rectangular selection as reusable component
- **Board Size**: Standardized 10x10 grid
- **Connectivity**: Boards can connect for multi-stage games

### Initial Feature Set
- Basic movement cards (Move 1-3, turns, back up)
- Simple board tiles
- Conveyor belts (movement enhancement)
- No damage system initially
- No complex hazards initially

## Development Priorities

### Phase 1 (MVP)
1. Level editor with drag-and-drop functionality
2. Basic game mechanics implementation
3. Asynchronous multiplayer system
4. Simple board elements and conveyor belts
5. 2-4 player support

### Future Phases
- Damage cards and combat system
- Additional board hazards (lasers, pits, etc.)
- Multi-board progression system
- Enhanced visual effects
- Mobile optimization

## Legal Considerations
- Original artwork and visual design
- Unique theme (not robot/factory)
- Modified terminology
- Different board layouts from original game