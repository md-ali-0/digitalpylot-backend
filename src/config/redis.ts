import logger from '@config/winston';
import Redis from 'ioredis';
import env from './env';

const redisClient = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  username: env.REDIS_USER,
  password: env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
  db: 0,
  connectTimeout: 10000, // 10 seconds
});

redisClient.on('connect', () => {
  logger.info('Connected to Redis');
});

redisClient.on('error', (err) => {
  logger.error('Redis connection error:', err);
});

redisClient.on('ready', () => {
  logger.info('Redis client ready');
});

redisClient.on('close', () => {
  logger.info('Redis connection closed');
});

export default redisClient;
