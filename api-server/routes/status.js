import { Router } from 'express';
import { redisClient } from '../services/redis.js';

const router = Router();

// actual route => GET /api/v1/status/:jobId
router.get('/:jobId', async (req, res) => {
  const { jobId } = req.params;
  const redisKey = `job:${jobId}`;

  try {
    const jobData = await redisClient.hGetAll(redisKey);

    // hGetAll returns an empty object => if the key doesn't exist
    if (Object.keys(jobData).length === 0) {
      return res.status(404).json({ error: 'job is not in Redis.' });
    }

    res.status(200).json(jobData);
  } catch (error) {
    console.error(`failed to get status => job ${jobId}:`, error);
    res.status(500).json({ error: 'server error.' });
  }
});

export default router;
