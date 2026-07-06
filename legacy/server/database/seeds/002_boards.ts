import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  // Delete existing entries
  await knex('boards').del();

  // Create sample board tiles (10x10 grid)
  const createEmptyBoard = (): Array<Array<{ type: string; direction?: string; checkpointNumber?: number }>> => {
    const board = [];
    for (let y = 0; y < 10; y++) {
      const row = [];
      for (let x = 0; x < 10; x++) {
        row.push({ type: 'floor' });
      }
      board.push(row);
    }
    return board;
  };

  // Simple racing board
  const simpleRaceBoard = createEmptyBoard();
  
  // Add walls around the perimeter
  for (let x = 0; x < 10; x++) {
    simpleRaceBoard[0][x] = { type: 'wall' };
    simpleRaceBoard[9][x] = { type: 'wall' };
  }
  for (let y = 0; y < 10; y++) {
    simpleRaceBoard[y][0] = { type: 'wall' };
    simpleRaceBoard[y][9] = { type: 'wall' };
  }
  
  // Add some conveyor belts
  simpleRaceBoard[3][3] = { type: 'conveyorNormal', direction: 'east' };
  simpleRaceBoard[3][4] = { type: 'conveyorNormal', direction: 'east' };
  simpleRaceBoard[3][5] = { type: 'conveyorNormal', direction: 'east' };
  
  // Add checkpoints
  simpleRaceBoard[2][5] = { type: 'checkpoint', checkpointNumber: 1 };
  simpleRaceBoard[7][5] = { type: 'checkpoint', checkpointNumber: 2 };
  simpleRaceBoard[5][8] = { type: 'checkpoint', checkpointNumber: 3 };

  // Complex maze board
  const mazeBoard = createEmptyBoard();
  
  // Create a maze pattern with walls
  const mazeWalls = [
    [1,1], [1,3], [1,5], [1,7],
    [2,2], [2,4], [2,6], [2,8],
    [3,1], [3,3], [3,5], [3,7],
    [4,2], [4,4], [4,6], [4,8],
    [5,1], [5,3], [5,5], [5,7],
    [6,2], [6,4], [6,6], [6,8],
    [7,1], [7,3], [7,5], [7,7],
    [8,2], [8,4], [8,6], [8,8],
  ];
  
  mazeWalls.forEach(([y, x]) => {
    if (y < 10 && x < 10) {
      mazeBoard[y][x] = { type: 'wall' };
    }
  });
  
  // Add checkpoints in maze
  mazeBoard[2][7] = { type: 'checkpoint', checkpointNumber: 1 };
  mazeBoard[6][3] = { type: 'checkpoint', checkpointNumber: 2 };
  mazeBoard[8][7] = { type: 'checkpoint', checkpointNumber: 3 };

  // Conveyor challenge board
  const conveyorBoard = createEmptyBoard();
  
  // Create conveyor belt patterns
  for (let x = 2; x < 8; x++) {
    conveyorBoard[2][x] = { type: 'conveyorNormal', direction: 'east' };
    conveyorBoard[7][x] = { type: 'conveyorNormal', direction: 'west' };
  }
  
  for (let y = 3; y < 7; y++) {
    conveyorBoard[y][2] = { type: 'conveyorNormal', direction: 'south' };
    conveyorBoard[y][7] = { type: 'conveyorNormal', direction: 'north' };
  }
  
  // Add fast conveyors
  conveyorBoard[4][4] = { type: 'conveyorFast', direction: 'north' };
  conveyorBoard[4][5] = { type: 'conveyorFast', direction: 'north' };
  conveyorBoard[5][4] = { type: 'conveyorFast', direction: 'north' };
  conveyorBoard[5][5] = { type: 'conveyorFast', direction: 'north' };
  
  // Add checkpoints
  conveyorBoard[1][5] = { type: 'checkpoint', checkpointNumber: 1 };
  conveyorBoard[8][5] = { type: 'checkpoint', checkpointNumber: 2 };

  // Insert seed entries
  await knex('boards').insert([
    {
      id: '650e8400-e29b-41d4-a716-446655440001',
      name: 'Simple Race',
      tiles: JSON.stringify(simpleRaceBoard),
      checkpoints: JSON.stringify([
        { id: 1, position: { x: 5, y: 2 } },
        { id: 2, position: { x: 5, y: 7 } },
        { id: 3, position: { x: 8, y: 5 } },
      ]),
      start_positions: JSON.stringify([
        { x: 1, y: 1 },
        { x: 1, y: 2 },
        { x: 1, y: 3 },
        { x: 1, y: 4 },
      ]),
      created_by: '550e8400-e29b-41d4-a716-446655440001', // admin
      is_public: true,
      rating: 4.2,
      usage_count: 25,
      description: 'A simple racing circuit perfect for beginners. Features basic conveyor belts and three checkpoints.',
      created_at: new Date('2024-01-01'),
      updated_at: new Date('2024-01-01'),
    },
    {
      id: '650e8400-e29b-41d4-a716-446655440002',
      name: 'Maze Runner',
      tiles: JSON.stringify(mazeBoard),
      checkpoints: JSON.stringify([
        { id: 1, position: { x: 7, y: 2 } },
        { id: 2, position: { x: 3, y: 6 } },
        { id: 3, position: { x: 7, y: 8 } },
      ]),
      start_positions: JSON.stringify([
        { x: 0, y: 0 },
        { x: 9, y: 0 },
        { x: 0, y: 9 },
        { x: 9, y: 9 },
      ]),
      created_by: '550e8400-e29b-41d4-a716-446655440002', // alice
      is_public: true,
      rating: 3.8,
      usage_count: 12,
      description: 'Navigate through a challenging maze to reach all checkpoints. Strategic planning required!',
      created_at: new Date('2024-01-02'),
      updated_at: new Date('2024-01-02'),
    },
    {
      id: '650e8400-e29b-41d4-a716-446655440003',
      name: 'Conveyor Chaos',
      tiles: JSON.stringify(conveyorBoard),
      checkpoints: JSON.stringify([
        { id: 1, position: { x: 5, y: 1 } },
        { id: 2, position: { x: 5, y: 8 } },
      ]),
      start_positions: JSON.stringify([
        { x: 0, y: 0 },
        { x: 9, y: 0 },
        { x: 0, y: 9 },
        { x: 9, y: 9 },
      ]),
      created_by: '550e8400-e29b-41d4-a716-446655440003', // bob
      is_public: true,
      rating: 4.5,
      usage_count: 18,
      description: 'Master the art of conveyor belt navigation in this fast-paced challenge board.',
      created_at: new Date('2024-01-03'),
      updated_at: new Date('2024-01-03'),
    },
    {
      id: '650e8400-e29b-41d4-a716-446655440004',
      name: 'Private Test Board',
      tiles: JSON.stringify(createEmptyBoard()),
      checkpoints: JSON.stringify([
        { id: 1, position: { x: 5, y: 5 } },
      ]),
      start_positions: JSON.stringify([
        { x: 1, y: 1 },
        { x: 8, y: 8 },
      ]),
      created_by: '550e8400-e29b-41d4-a716-446655440004', // carol
      is_public: false,
      rating: 0,
      usage_count: 2,
      description: 'A private test board for experimenting with new layouts.',
      created_at: new Date('2024-01-04'),
      updated_at: new Date('2024-01-04'),
    },
  ]);
}