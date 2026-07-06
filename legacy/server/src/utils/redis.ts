import { createClient, RedisClientType } from 'redis';
import { logger } from '@/utils/logger';

let redisClient: RedisClientType;

export async function setupRedis(): Promise<void> {
  try {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    redisClient = createClient({
      url: redisUrl,
    });

    redisClient.on('error', (error) => {
      logger.error('Redis error:', error);
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
    });

    redisClient.on('end', () => {
      logger.info('Redis client disconnected');
    });

    await redisClient.connect();
    
    // Test the connection
    await redisClient.ping();
    logger.info('Redis connected successfully');

  } catch (error) {
    logger.error('Redis connection failed:', error);
    throw error;
  }
}

export function getRedisClient(): RedisClientType {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call setupRedis() first.');
  }
  return redisClient;
}

export async function closeRedis(): Promise<void> {
  try {
    if (redisClient) {
      await redisClient.quit();
      logger.info('Redis connection closed');
    }
  } catch (error) {
    logger.error('Error closing Redis connection:', error);
    throw error;
  }
}

// Redis health check
export async function checkRedisHealth(): Promise<{ healthy: boolean; latency?: number }> {
  try {
    const start = Date.now();
    await redisClient.ping();
    const latency = Date.now() - start;
    
    return { healthy: true, latency };
  } catch (error) {
    logger.error('Redis health check failed:', error);
    return { healthy: false };
  }
}

// Game state management utilities
export class GameStateManager {
  private static readonly GAME_PREFIX = 'game:';
  private static readonly SUBMISSION_PREFIX = 'submissions:';
  private static readonly LOBBY_PREFIX = 'lobby:';
  private static readonly SESSION_PREFIX = 'session:';

  static async setGameState(gameId: string, gameState: unknown, ttl: number = 3600): Promise<void> {
    const key = `${this.GAME_PREFIX}${gameId}`;
    await redisClient.setEx(key, ttl, JSON.stringify(gameState));
  }

  static async getGameState<T>(gameId: string): Promise<T | null> {
    const key = `${this.GAME_PREFIX}${gameId}`;
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) as T : null;
  }

  static async deleteGameState(gameId: string): Promise<void> {
    const key = `${this.GAME_PREFIX}${gameId}`;
    await redisClient.del(key);
  }

  static async setTurnSubmission(
    gameId: string, 
    playerId: string, 
    cards: unknown[], 
    ttl: number = 1800
  ): Promise<void> {
    const key = `${this.SUBMISSION_PREFIX}${gameId}`;
    await redisClient.hSet(key, playerId, JSON.stringify(cards));
    await redisClient.expire(key, ttl);
  }

  static async getTurnSubmissions(gameId: string): Promise<Record<string, unknown[]>> {
    const key = `${this.SUBMISSION_PREFIX}${gameId}`;
    const submissions = await redisClient.hGetAll(key);
    
    const result: Record<string, unknown[]> = {};
    for (const [playerId, cardsJson] of Object.entries(submissions)) {
      result[playerId] = JSON.parse(cardsJson) as unknown[];
    }
    
    return result;
  }

  static async clearTurnSubmissions(gameId: string): Promise<void> {
    const key = `${this.SUBMISSION_PREFIX}${gameId}`;
    await redisClient.del(key);
  }

  static async setPlayerSession(
    playerId: string, 
    sessionData: unknown, 
    ttl: number = 86400
  ): Promise<void> {
    const key = `${this.SESSION_PREFIX}${playerId}`;
    await redisClient.setEx(key, ttl, JSON.stringify(sessionData));
  }

  static async getPlayerSession<T>(playerId: string): Promise<T | null> {
    const key = `${this.SESSION_PREFIX}${playerId}`;
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) as T : null;
  }

  static async deletePlayerSession(playerId: string): Promise<void> {
    const key = `${this.SESSION_PREFIX}${playerId}`;
    await redisClient.del(key);
  }

  static async addToLobby(gameId: string, gameData: unknown, ttl: number = 7200): Promise<void> {
    const key = `${this.LOBBY_PREFIX}${gameId}`;
    await redisClient.setEx(key, ttl, JSON.stringify(gameData));
  }

  static async removeFromLobby(gameId: string): Promise<void> {
    const key = `${this.LOBBY_PREFIX}${gameId}`;
    await redisClient.del(key);
  }

  static async getLobbyGames(): Promise<Array<{ gameId: string; data: unknown }>> {
    const keys = await redisClient.keys(`${this.LOBBY_PREFIX}*`);
    const games: Array<{ gameId: string; data: unknown }> = [];
    
    for (const key of keys) {
      const data = await redisClient.get(key);
      if (data) {
        const gameId = key.replace(this.LOBBY_PREFIX, '');
        games.push({ gameId, data: JSON.parse(data) });
      }
    }
    
    return games;
  }
}