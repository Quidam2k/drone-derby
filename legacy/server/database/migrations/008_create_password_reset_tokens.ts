import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('password_reset_tokens', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'))
    table.uuid('user_id').notNullable()
    table.string('token', 64).notNullable().unique()
    table.timestamp('expires_at').notNullable()
    table.boolean('used').defaultTo(false)
    table.timestamps(true, true)

    // Foreign key constraint
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE')
    
    // Index on token for fast lookups
    table.index('token')
    
    // Index on user_id for cleanup queries
    table.index('user_id')
    
    // Index on expires_at for cleanup of expired tokens
    table.index('expires_at')
    
    // Unique constraint on user_id to allow only one active reset token per user
    table.unique('user_id')
  })
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists('password_reset_tokens')
}