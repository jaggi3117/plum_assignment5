import { consumeFromQueue } from './services/rabbitmq.js';
import { redisClient } from './services/redis.js';
import { downloadFileFromS3 } from './services/s3.js';
import {
    performOCR,
    extractEntities,
    normalizeEntities,
    applyGuardrailsAndFinalize,
} from './services/ocrProcessor.js';
import { dbPool } from './services/postgres.js';

const QUEUE_NAME = 'scheduling_queue'; // unique queue on which api-server pushed task

async function handleMessage(msg) {
    const messageContent = msg.content.toString();
    const { jobId, type, data } = JSON.parse(messageContent);
    const redisKey = `job:${jobId}`;

    try {
        console.log(`[${jobId}] currently processing job of type: ${type}`);
        await redisClient.hSet(redisKey, {
            status: 'processing',
            updatedAt: new Date().toISOString(),
        });

        // get raw text from input/ocr utility
        let ocrResult = { raw_text: null, confidence: 1.0 };
        if (type === 'image') {
            const imageBuffer = await downloadFileFromS3(data.s3Key);
            if (!imageBuffer) throw new Error('failed to get image from s3.');
            ocrResult = await performOCR(imageBuffer);
            await redisClient.hSet(redisKey, {
                'step1_ocr_text': ocrResult.raw_text,
                'step1_ocr_confidence': (ocrResult.confidence ?? 0).toString(),
            });
        } else if (type === 'text') {
            ocrResult.raw_text = data.rawText;
        } else {
            throw new Error(`unsupported input job type: ${type}`);
        }

        // entity extraction
        const { entities } = await extractEntities(ocrResult.raw_text);
        await redisClient.hSet(redisKey, {
            'step2_entity_department': entities.department || 'N/A',
            'step2_entity_date_phrase': entities.date_phrase || 'N/A',
            'step2_entity_time_phrase': entities.time_phrase || 'N/A',
            'step2_entity_confidence': (entities.confidence ?? 0).toString(), // safety check added here
        });

        // normalization
        const { normalized } = await normalizeEntities(entities);
        await redisClient.hSet(redisKey, {
            'step3_normalized_date': normalized.date || 'N/A',
            'step3_normalized_time': normalized.time || 'N/A',

            //  if confidence is null it might crash i guess, using ?? to provide a default value 0 here
            'step3_normalized_confidence': (normalized.confidence ?? 0).toString(),
        });

        // guardrails and finalization
        const finalResult = applyGuardrailsAndFinalize(entities, normalized);

        // catch null date/time from failed normalization
        if (finalResult.status === 'needs_clarification') {
            throw new Error(finalResult.message);
        }
        const { appointment } = finalResult;
        const query = `
          INSERT INTO Appointments (department, appointment_date, appointment_time, timezone)
          VALUES ($1, $2, $3, $4)
          RETURNING id;
        `;
        const values = [
            appointment.department,
            appointment.date,
            appointment.time,
            appointment.tz,
        ];
        const result = await dbPool.query(query, values);
        const appointmentId = result.rows[0].id;

        await redisClient.hSet(redisKey, {
            status: 'completed',
            appointmentId: appointmentId,
            updatedAt: new Date().toISOString(),
            result_department: appointment.department,
            result_date: appointment.date,
            result_time: appointment.time,
        });

        console.log(`[${jobId}] job completed successfully. Appointment ID: ${appointmentId}`);

    } catch (error) {
        console.error(`[${jobId}] Job failed:`, error.message);
        await redisClient.hSet(redisKey, {
            status: 'failed',
            errorMessage: error.message,
            updatedAt: new Date().toISOString(),
        });
    }
}

// keep the worker running for more jobs
console.log('worker process is running and waiting for jobs in the rabbitMQ !!...');
consumeFromQueue(QUEUE_NAME, handleMessage);
