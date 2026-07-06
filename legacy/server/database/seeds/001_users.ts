import { Knex } from 'knex';
import bcrypt from 'bcryptjs';

export async function seed(knex: Knex): Promise<void> {
  // Delete existing entries
  await knex('users').del();

  // Hash passwords for test users
  const saltRounds = 12;
  const adminPassword = await bcrypt.hash('admin123', saltRounds);
  const testPassword = await bcrypt.hash('test123', saltRounds);

  // Insert seed entries
  await knex('users').insert([
    {
      id: '550e8400-e29b-41d4-a716-446655440001',
      username: 'admin',
      email: 'admin@dronderby.com',
      password_hash: adminPassword,
      display_name: 'Administrator',
      games_played: 0,
      games_won: 0,
      win_rate: 0.0,
      average_turns: 0,
      total_play_time: 0,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440002',
      username: 'alice',
      email: 'alice@example.com',
      password_hash: testPassword,
      display_name: 'Alice Johnson',
      games_played: 15,
      games_won: 8,
      win_rate: 0.5333,
      average_turns: 12,
      total_play_time: 7200, // 2 hours
      created_at: new Date('2024-01-01'),
      updated_at: new Date(),
      last_login_at: new Date(),
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440003',
      username: 'bob',
      email: 'bob@example.com',
      password_hash: testPassword,
      display_name: 'Bob Smith',
      games_played: 22,
      games_won: 12,
      win_rate: 0.5455,
      average_turns: 14,
      total_play_time: 10800, // 3 hours
      created_at: new Date('2024-01-02'),
      updated_at: new Date(),
      last_login_at: new Date(),
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440004',
      username: 'carol',
      email: 'carol@example.com',
      password_hash: testPassword,
      display_name: 'Carol Davis',
      games_played: 8,
      games_won: 6,
      win_rate: 0.7500,
      average_turns: 10,
      total_play_time: 3600, // 1 hour
      created_at: new Date('2024-01-03'),
      updated_at: new Date(),
      last_login_at: new Date(),
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440005',
      username: 'david',
      email: 'david@example.com',
      password_hash: testPassword,
      display_name: 'David Wilson',
      games_played: 5,
      games_won: 1,
      win_rate: 0.2000,
      average_turns: 18,
      total_play_time: 2700, // 45 minutes
      created_at: new Date('2024-01-04'),
      updated_at: new Date(),
      last_login_at: new Date(),
    },
  ]);
}