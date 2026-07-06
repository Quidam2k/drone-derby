import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  // Delete existing entries
  await knex('templates').del();

  // Template 1: Corner Room
  const cornerRoom = [
    [{ type: 'wall' }, { type: 'wall' }, { type: 'wall' }, { type: 'wall' }],
    [{ type: 'wall' }, { type: 'floor' }, { type: 'floor' }, { type: 'wall' }],
    [{ type: 'wall' }, { type: 'floor' }, { type: 'checkpoint', checkpointNumber: 1 }, { type: 'wall' }],
    [{ type: 'wall' }, { type: 'wall' }, { type: 'wall' }, { type: 'wall' }],
  ];

  // Template 2: Conveyor Spiral
  const conveyorSpiral = [
    [{ type: 'conveyorNormal', direction: 'east' }, { type: 'conveyorNormal', direction: 'east' }, { type: 'conveyorNormal', direction: 'east' }, { type: 'conveyorNormal', direction: 'east' }, { type: 'conveyorNormal', direction: 'south' }],
    [{ type: 'conveyorNormal', direction: 'north' }, { type: 'floor' }, { type: 'floor' }, { type: 'floor' }, { type: 'conveyorNormal', direction: 'south' }],
    [{ type: 'conveyorNormal', direction: 'north' }, { type: 'floor' }, { type: 'checkpoint', checkpointNumber: 2 }, { type: 'floor' }, { type: 'conveyorNormal', direction: 'south' }],
    [{ type: 'conveyorNormal', direction: 'north' }, { type: 'floor' }, { type: 'floor' }, { type: 'floor' }, { type: 'conveyorNormal', direction: 'south' }],
    [{ type: 'conveyorNormal', direction: 'north' }, { type: 'conveyorNormal', direction: 'west' }, { type: 'conveyorNormal', direction: 'west' }, { type: 'conveyorNormal', direction: 'west' }, { type: 'conveyorNormal', direction: 'west' }],
  ];

  // Template 3: T-Junction
  const tJunction = [
    [{ type: 'floor' }, { type: 'floor' }, { type: 'floor' }],
    [{ type: 'wall' }, { type: 'floor' }, { type: 'wall' }],
    [{ type: 'wall' }, { type: 'floor' }, { type: 'wall' }],
  ];

  // Template 4: Fast Lane
  const fastLane = [
    [{ type: 'wall' }],
    [{ type: 'conveyorFast', direction: 'south' }],
    [{ type: 'conveyorFast', direction: 'south' }],
    [{ type: 'conveyorFast', direction: 'south' }],
    [{ type: 'conveyorFast', direction: 'south' }],
    [{ type: 'wall' }],
  ];

  // Template 5: Cross Roads
  const crossRoads = [
    [{ type: 'wall' }, { type: 'floor' }, { type: 'wall' }],
    [{ type: 'floor' }, { type: 'floor' }, { type: 'floor' }],
    [{ type: 'wall' }, { type: 'floor' }, { type: 'wall' }],
  ];

  // Template 6: Start Area
  const startArea = [
    [{ type: 'start' }, { type: 'floor' }],
    [{ type: 'start' }, { type: 'floor' }],
    [{ type: 'start' }, { type: 'floor' }],
    [{ type: 'start' }, { type: 'floor' }],
  ];

  // Insert seed entries
  await knex('templates').insert([
    {
      id: '750e8400-e29b-41d4-a716-446655440001',
      name: 'Corner Room',
      description: 'A simple corner room with walls and a checkpoint. Perfect for maze corners.',
      width: 4,
      height: 4,
      tiles: JSON.stringify(cornerRoom),
      preview_image: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjZjNmNGY2Ii8+CjxyZWN0IHg9IjAiIHk9IjAiIHdpZHRoPSI0MCIgaGVpZ2h0PSIxMCIgZmlsbD0iIzM3NDE1MSIvPgo8cmVjdCB4PSIwIiB5PSIwIiB3aWR0aD0iMTAiIGhlaWdodD0iNDAiIGZpbGw9IiMzNzQxNTEiLz4KPHJlY3QgeD0iMzAiIHk9IjAiIHdpZHRoPSIxMCIgaGVpZ2h0PSI0MCIgZmlsbD0iIzM3NDE1MSIvPgo8cmVjdCB4PSIwIiB5PSIzMCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjMzc0MTUxIi8+CjxjaXJjbGUgY3g9IjI1IiBjeT0iMjUiIHI9IjMiIGZpbGw9IiNmYmJmMjQiLz4KPC9zdmc+',
      created_by: '550e8400-e29b-41d4-a716-446655440001', // admin
      is_public: true,
      tags: JSON.stringify(['room', 'corner', 'checkpoint', 'basic']),
      rating: 4.3,
      downloads: 127,
      category: 'rooms',
      created_at: new Date('2024-01-01'),
      updated_at: new Date('2024-01-01'),
    },
    {
      id: '750e8400-e29b-41d4-a716-446655440002',
      name: 'Conveyor Spiral',
      description: 'A spiral of conveyor belts with a checkpoint in the center. Creates interesting movement patterns.',
      width: 5,
      height: 5,
      tiles: JSON.stringify(conveyorSpiral),
      preview_image: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHZpZXdCb3g9IjAgMCA1MCA1MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjUwIiBoZWlnaHQ9IjUwIiBmaWxsPSIjZjNmNGY2Ii8+CjxyZWN0IHg9IjAiIHk9IjAiIHdpZHRoPSI1MCIgaGVpZ2h0PSIxMCIgZmlsbD0iIzNiODJmNiIvPgo8cmVjdCB4PSI0MCIgeT0iMCIgd2lkdGg9IjEwIiBoZWlnaHQ9IjUwIiBmaWxsPSIjM2I4MmY2Ii8+CjxyZWN0IHg9IjAiIHk9IjQwIiB3aWR0aD0iNTAiIGhlaWdodD0iMTAiIGZpbGw9IiMzYjgyZjYiLz4KPHJlY3QgeD0iMCIgeT0iMTAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIzMCIgZmlsbD0iIzNiODJmNiIvPgo8Y2lyY2xlIGN4PSIyNSIgY3k9IjI1IiByPSIzIiBmaWxsPSIjZmJiZjI0Ii8+Cjwvc3ZnPg==',
      created_by: '550e8400-e29b-41d4-a716-446655440002', // alice
      is_public: true,
      tags: JSON.stringify(['conveyor', 'spiral', 'checkpoint', 'advanced']),
      rating: 4.7,
      downloads: 89,
      category: 'obstacles',
      created_at: new Date('2024-01-02'),
      updated_at: new Date('2024-01-02'),
    },
    {
      id: '750e8400-e29b-41d4-a716-446655440003',
      name: 'T-Junction',
      description: 'A simple T-shaped junction for creating branching paths in your board.',
      width: 3,
      height: 3,
      tiles: JSON.stringify(tJunction),
      preview_image: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAiIGhlaWdodD0iMzAiIHZpZXdCb3g9IjAgMCAzMCAzMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMwIiBoZWlnaHQ9IjMwIiBmaWxsPSIjZjNmNGY2Ii8+CjxyZWN0IHg9IjAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMjAiIGZpbGw9IiMzNzQxNTEiLz4KPHJlY3QgeD0iMjAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMjAiIGZpbGw9IiMzNzQxNTEiLz4KPC9zdmc+',
      created_by: '550e8400-e29b-41d4-a716-446655440003', // bob
      is_public: true,
      tags: JSON.stringify(['junction', 'intersection', 'path', 'basic']),
      rating: 4.1,
      downloads: 156,
      category: 'intersections',
      created_at: new Date('2024-01-03'),
      updated_at: new Date('2024-01-03'),
    },
    {
      id: '750e8400-e29b-41d4-a716-446655440004',
      name: 'Fast Lane',
      description: 'A vertical strip of fast conveyor belts for rapid north-south movement.',
      width: 1,
      height: 6,
      tiles: JSON.stringify(fastLane),
      preview_image: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCAxMCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjZjNmNGY2Ii8+CjxyZWN0IHg9IjAiIHk9IjAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iIzM3NDE1MSIvPgo8cmVjdCB4PSIwIiB5PSI1MCIgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjMzc0MTUxIi8+CjxyZWN0IHg9IjAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iNDAiIGZpbGw9IiMxZDRlZDgiLz4KPC9zdmc+',
      created_by: '550e8400-e29b-41d4-a716-446655440004', // carol
      is_public: true,
      tags: JSON.stringify(['conveyor', 'fast', 'vertical', 'speed']),
      rating: 4.4,
      downloads: 73,
      category: 'obstacles',
      created_at: new Date('2024-01-04'),
      updated_at: new Date('2024-01-04'),
    },
    {
      id: '750e8400-e29b-41d4-a716-446655440005',
      name: 'Cross Roads',
      description: 'A simple crossroads intersection for creating complex path networks.',
      width: 3,
      height: 3,
      tiles: JSON.stringify(crossRoads),
      preview_image: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAiIGhlaWdodD0iMzAiIHZpZXdCb3g9IjAgMCAzMCAzMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMwIiBoZWlnaHQ9IjMwIiBmaWxsPSIjZjNmNGY2Ii8+CjxyZWN0IHg9IjAiIHk9IjAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iIzM3NDE1MSIvPgo8cmVjdCB4PSIyMCIgeT0iMCIgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjMzc0MTUxIi8+CjxyZWN0IHg9IjAiIHk9IjIwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiMzNzQxNTEiLz4KPHJlY3QgeD0iMjAiIHk9IjIwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiMzNzQxNTEiLz4KPC9zdmc+',
      created_by: '550e8400-e29b-41d4-a716-446655440005', // david
      is_public: true,
      tags: JSON.stringify(['intersection', 'crossroads', 'path', 'basic']),
      rating: 4.2,
      downloads: 98,
      category: 'intersections',
      created_at: new Date('2024-01-05'),
      updated_at: new Date('2024-01-05'),
    },
    {
      id: '750e8400-e29b-41d4-a716-446655440006',
      name: 'Start Area',
      description: 'A vertical arrangement of start positions for 4-player games.',
      width: 2,
      height: 4,
      tiles: JSON.stringify(startArea),
      preview_image: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCAyMCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjIwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjZjNmNGY2Ii8+CjxyZWN0IHg9IjAiIHk9IjAiIHdpZHRoPSIxMCIgaGVpZ2h0PSI0MCIgZmlsbD0iIzEwYjk4MSIvPgo8L3N2Zz4=',
      created_by: '550e8400-e29b-41d4-a716-446655440001', // admin
      is_public: true,
      tags: JSON.stringify(['start', 'spawn', 'player', 'basic']),
      rating: 4.6,
      downloads: 203,
      category: 'decorative',
      created_at: new Date('2024-01-06'),
      updated_at: new Date('2024-01-06'),
    },
  ]);
}