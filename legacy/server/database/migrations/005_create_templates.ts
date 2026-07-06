import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('templates', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('name', 100).notNullable();
    table.text('description');
    table.integer('width').notNullable(); // Template dimensions
    table.integer('height').notNullable();
    table.json('tiles').notNullable(); // 2D array of tile objects
    table.text('preview_image'); // Base64 encoded thumbnail or file path
    table.uuid('created_by').notNullable();
    table.boolean('is_public').defaultTo(false);
    table.json('tags').defaultTo('[]'); // Array of tag strings
    table.decimal('rating', 3, 2).defaultTo(0); // 0.00 to 5.00
    table.integer('downloads').defaultTo(0);
    table.string('category', 50); // e.g., 'rooms', 'intersections', 'obstacles'
    table.json('metadata'); // Additional template properties
    table.timestamps(true, true);
    
    // Foreign key constraint
    table.foreign('created_by').references('id').inTable('users').onDelete('CASCADE');
    
    // Indexes for common queries
    table.index(['created_by']);
    table.index(['is_public']);
    table.index(['rating']);
    table.index(['downloads']);
    table.index(['category']);
    table.index(['created_at']);
    
    // Text search index for name and description
    table.index(['name']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('templates');
}