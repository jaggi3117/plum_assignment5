import amqp from 'amqplib';
import dotenv from 'dotenv';

dotenv.config();

export const consumeFromQueue = async (queueName, callback) => {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    const channel = await connection.createChannel();

    await channel.assertQueue(queueName, { durable: true });

    // only process 1 message at a time because most probably this worker process will run as single instance
    channel.prefetch(1);

    console.log(`[*] waiting for more tasks in ${queueName}.`);

    channel.consume(queueName, async (msg) => {
      if (msg !== null) {
        await callback(msg);
        // send ack on the channle
        channel.ack(msg);
      }
    });
  } catch (error) {
    console.error('failed to get from RabbitMQ', error);
  }
};
