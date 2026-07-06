import knex, { Knex } from 'knex';
import path from 'path';
import { logger } from '@/utils/logger';

const knexConfig = require(path.join(__dirname, '../../knexfile.js'));

const environment = process.env.NODE_ENV || 'development';
const config = knexConfig[environment];

if (!config) {
  throw new Error(`No database configuration found for environment: ${environment}`);
}

export const db: Knex = knex(config);

export async function setupDatabase(): Promise<void> {
  try {
    // Test the connection
    await db.raw('SELECT 1');
    logger.info(`Database connected successfully in ${environment} mode`);

    // Run migrations in production
    if (environment === 'production') {
      logger.info('Running database migrations...');
      await db.migrate.latest();
      logger.info('Database migrations completed');
    }

  } catch (error) {
    logger.error('Database connection failed:', error);
    throw error;
  }
}

export async function closeDatabase(): Promise<void> {
  try {
    await db.destroy();
    logger.info('Database connection closed');
  } catch (error) {
    logger.error('Error closing database connection:', error);
    throw error;
  }
}

// Database health check
export async function checkDatabaseHealth(): Promise<{ healthy: boolean; latency?: number }> {
  try {
    const start = Date.now();
    await db.raw('SELECT 1');
    const latency = Date.now() - start;
    
    return { healthy: true, latency };
  } catch (error) {
    logger.error('Database health check failed:', error);
    return { healthy: false };
  }
}