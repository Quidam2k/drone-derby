import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create enum for notification types
  await knex.raw(`
    CREATE TYPE notification_type AS ENUM (
      'game_invitation',
      'game_started', 
      'turn_ready',
      'turn_complete',
      'game_complete',
      'player_joined',
      'player_left',
      'board_shared',
      'template_shared',
      'system_announcement'
    );
  `);

  // Create enum for notification levels
  await knex.raw(`
    CREATE TYPE notification_level AS ENUM ('info', 'success', 'warning', 'error');
  `);

  await knex.schema.createTable('notifications', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable();
    table.specificType('type', 'notification_type').notNullable();
    table.specificType('level', 'notification_level').defaultTo('info');
    table.string('title', 255).notNullable();
    table.text('message').notNullable();
    table.json('data'); // Additional notification data (game_id, etc.)
    table.boolean('is_read').defaultTo(false);
    table.boolean('is_dismissed').defaultTo(false);
    table.string('action_url'); // Optional URL for action button
    table.string('action_text'); // Optional text for action button
    table.timestamps(true, true);
    table.timestamp('expires_at'); // Optional expiration
    table.timestamp('read_at');
    
    // Foreign key constraint
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    
    // Indexes for common queries
    table.index(['user_id']);
    table.index(['type']);
    table.index(['is_read']);
    table.index(['is_dismissed']);
    table.index(['created_at']);
    table.index(['expires_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('notifications');
  await knex.raw('DROP TYPE IF EXISTS notification_type;');
  await knex.raw('DROP TYPE IF EXISTS notification_level;');
}