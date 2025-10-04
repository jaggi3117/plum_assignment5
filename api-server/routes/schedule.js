import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { upload } from '../services/s3.js';
import { redisClient } from '../services/redis.js';
import { publishToQueue } from '../services/rabbitmq.js';

const router = Router();

// This single endpoint now handles both multipart/form-data (for images)
// and application/json (for text)
router.post('/', upload.single('image'), async (req, res) => {
    const jobId = uuidv4();
    const queueName = 'scheduling_queue';
    let jobData;
    let messagePayload;

    try {
        // case 1: if its an image
        if (req.file) {
            jobData = {
                status: 'pending',
                inputType: 'image',
                s3Key: req.file.key,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            messagePayload = {
                jobId,
                type: 'image',
                data: { s3Key: req.file.key },
            };
        }
        // case 2: if its raw text from body
        else if (req.body && req.body.text) {
             jobData = {
                status: 'pending',
                inputType: 'text',
                rawText: req.body.text,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            messagePayload = {
                jobId,
                type: 'text',
                data: { rawText: req.body.text },
            };
        }
        // case 3: fill else block
        else {
            return res.status(400).json({ error: 'request must be an image file or a json object with a "text" key.' });
        }

        // set key = jobId and value is jobData nested data in redis
        await redisClient.hSet(`job:${jobId}`, jobData);

        // publish message payload in the rabbitMQ
        await publishToQueue(queueName, messagePayload);

        // Respond to the client
        res.status(202).json({
            message: 'request isbeing processed {inside queue}',
            jobId,
        });
    } catch (error) {
        console.error('failed to schedule job:', error);
        res.status(500).json({ error: 'server error.' });
    }
});

export default router;
