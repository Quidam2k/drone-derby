import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create enum for robot facing direction
  await knex.raw(`
    CREATE TYPE robot_direction AS ENUM ('north', 'south', 'east', 'west');
  `);

  await knex.schema.createTable('game_players', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('game_id').notNullable();
    table.uuid('user_id').notNullable();
    table.integer('player_number').notNullable(); // 1-4, determines turn order and robot color
    table.integer('robot_position_x').notNullable().defaultTo(0);
    table.integer('robot_position_y').notNullable().defaultTo(0);
    table.specificType('robot_facing', 'robot_direction').defaultTo('north');
    table.json('checkpoints_reached').defaultTo('[]'); // Array of checkpoint IDs
    table.boolean('is_ready').defaultTo(false); // Ready for current turn
    table.json('current_hand'); // Current cards in hand
    table.json('selected_cards'); // Cards selected for registers 1-5
    table.timestamp('joined_at').defaultTo(knex.fn.now());
    table.timestamp('left_at'); // NULL if still active
    table.timestamp('last_seen').defaultTo(knex.fn.now());
    
    // Foreign key constraints
    table.foreign('game_id').references('id').inTable('games').onDelete('CASCADE');
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    
    // Unique constraint - each user can only be in a game once
    table.unique(['game_id', 'user_id']);
    
    // Unique constraint - each player number per game
    table.unique(['game_id', 'player_number']);
    
    // Indexes for common queries
    table.index(['game_id']);
    table.index(['user_id']);
    table.index(['is_ready']);
    table.index(['joined_at']);
    table.index(['last_seen']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('game_players');
  await knex.raw('DROP TYPE IF EXISTS robot_direction;');
}