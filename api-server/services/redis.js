import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

export const redisClient = createClient({
  url: process.env.REDIS_URL,
});

redisClient.on('error', (err) => console.log('Redis client failed', err));

// asynch connection => because network call
(async () => {
  await redisClient.connect();
  console.log('Redis connected successfully.');
})();
