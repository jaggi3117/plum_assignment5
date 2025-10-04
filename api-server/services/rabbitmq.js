import amqp from 'amqplib';
import dotenv from 'dotenv';

dotenv.config();

let connection = null; // will store active rabbitmq connection
let channel = null; // channel to send/recv object to/from rabbitmq

const connectRabbitMQ = async () => {
  if (channel) return;
  try {
    connection = await amqp.connect(process.env.RABBITMQ_URL);
    channel = await connection.createChannel();
    console.log('RabbitMQ connected successfully.');
  } catch (error) {
    console.error('failed to connect to RabbitMQ', error);
    process.exit(1); // exit with status code 1 => means error
  }
};

export const publishToQueue = async (queueName, data) => {
  await connectRabbitMQ();
  await channel.assertQueue(queueName, { durable: true }); // make it durable -> if rabbit restart queue will persist
  channel.sendToQueue(queueName, Buffer.from(JSON.stringify(data)), {
    persistent: true,
  });
  console.log(`task for job sent to queue: ${queueName}`);
};
