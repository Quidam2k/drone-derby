import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('username', 50).notNullable().unique();
    table.string('email', 255).notNullable().unique();
    table.string('password_hash', 255).notNullable();
    table.string('display_name', 100).notNullable();
    table.text('avatar'); // URL or base64 image data
    table.integer('games_played').defaultTo(0);
    table.integer('games_won').defaultTo(0);
    table.decimal('win_rate', 5, 4).defaultTo(0); // e.g., 0.7500 for 75%
    table.integer('average_turns').defaultTo(0);
    table.integer('total_play_time').defaultTo(0); // seconds
    table.timestamps(true, true); // created_at, updated_at
    table.timestamp('last_login_at');
    
    // Indexes for common queries
    table.index(['email']);
    table.index(['username']);
    table.index(['created_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('users');
}