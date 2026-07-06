import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('game_turns', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('game_id').notNullable();
    table.integer('turn_number').notNullable();
    table.json('player_submissions').notNullable(); // Map of player_id -> selected cards
    table.json('execution_results').notNullable(); // Results of turn execution
    table.json('board_state_before'); // Board state before turn execution
    table.json('board_state_after'); // Board state after turn execution
    table.integer('execution_time_ms'); // Time taken to execute turn
    table.timestamps(true, true);
    
    // Foreign key constraint
    table.foreign('game_id').references('id').inTable('games').onDelete('CASCADE');
    
    // Unique constraint - one record per game per turn
    table.unique(['game_id', 'turn_number']);
    
    // Indexes for common queries
    table.index(['game_id']);
    table.index(['turn_number']);
    table.index(['created_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('game_turns');
}