import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

export const redisClient = createClient({
  url: process.env.REDIS_URL,
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));

// Connect asynchronously
(async () => {
  await redisClient.connect();
  console.log('Redis connected successfully.');
})();
