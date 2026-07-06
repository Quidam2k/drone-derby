import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('boards', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 100).notNullable();
    table.json('tiles').notNullable(); // 2D array of tile objects
    table.json('checkpoints').notNullable(); // Array of {id, position} objects
    table.json('start_positions').notNullable(); // Array of {x, y} objects
    table.uuid('created_by').notNullable();
    table.boolean('is_public').defaultTo(false);
    table.decimal('rating', 3, 2).defaultTo(0); // 0.00 to 5.00
    table.integer('usage_count').defaultTo(0);
    table.text('description');
    table.json('metadata'); // Additional board properties
    table.timestamps(true, true);
    
    // Foreign key constraint
    table.foreign('created_by').references('id').inTable('users').onDelete('CASCADE');
    
    // Indexes for common queries
    table.index(['created_by']);
    table.index(['is_public']);
    table.index(['rating']);
    table.index(['created_at']);
    table.index(['usage_count']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('boards');
}