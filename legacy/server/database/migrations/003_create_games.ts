import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create enum for game phases
  await knex.raw(`
    CREATE TYPE game_phase AS ENUM ('waiting', 'programming', 'executing', 'complete', 'cancelled');
  `);

  await knex.schema.createTable('games', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 100); // Optional game name
    table.uuid('board_id').notNullable();
    table.uuid('created_by').notNullable();
    table.integer('max_players').notNullable().defaultTo(4);
    table.integer('current_turn').defaultTo(1);
    table.specificType('phase', 'game_phase').defaultTo('waiting');
    table.boolean('is_private').defaultTo(false);
    table.string('password_hash'); // Optional password for private games
    table.json('game_settings'); // Optional settings like turn timeouts
    table.timestamps(true, true);
    table.timestamp('last_activity').defaultTo(knex.fn.now());
    table.timestamp('completed_at');
    table.uuid('winner_id'); // Winning player
    
    // Foreign key constraints
    table.foreign('board_id').references('id').inTable('boards').onDelete('RESTRICT');
    table.foreign('created_by').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('winner_id').references('id').inTable('users').onDelete('SET NULL');
    
    // Indexes for common queries
    table.index(['created_by']);
    table.index(['board_id']);
    table.index(['phase']);
    table.index(['is_private']);
    table.index(['created_at']);
    table.index(['last_activity']);
    table.index(['completed_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('games');
  await knex.raw('DROP TYPE IF EXISTS game_phase;');
}