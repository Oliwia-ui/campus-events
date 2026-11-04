import amqp from 'amqplib';
import { REGISTRATION_CREATED } from './messageTypes.mjs';

export const MAIL_QUEUE = 'campus-events.mail';

// One connection for the whole process (free brokers allow only a few), with two channels:
// a confirm channel to publish and a normal channel to consume.
// amqplib's recovery option reconnects with backoff; `setup` runs after every (re)connect
// because channels and consumers die together with the connection.
export async function connectRabbit({ url, exchange, onMailMessage, logger }) {
  let publisher = null;

  const connection = await amqp.connect(url, {
    recovery: {
      waitForConnect: false, // don't block API startup when the broker is down
      maxRetries: Infinity,
      maxDelay: 30_000,
      async setup(model) {
        const publishChannel = await model.createConfirmChannel();
        await publishChannel.assertExchange(exchange, 'topic', { durable: true });

        const consumeChannel = await model.createChannel();
        // durable queue + persistent messages: they survive a broker restart.
        await consumeChannel.assertQueue(MAIL_QUEUE, { durable: true });
        await consumeChannel.bindQueue(MAIL_QUEUE, exchange, REGISTRATION_CREATED);
        await consumeChannel.prefetch(5); // at most 5 unacked mails in progress
        await consumeChannel.consume(MAIL_QUEUE, (msg) => onMailMessage(consumeChannel, msg));

        publisher = publishChannel;
      }
    }
  });

  connection.on('connect', () => logger.info('RabbitMQ connected'));
  connection.on('disconnect', (error) => {
    publisher = null;
    logger.warn('RabbitMQ disconnected, reconnecting', { error: error?.message });
  });
  connection.on('connect-failed', (error) => logger.warn('RabbitMQ connection failed', { error: error.message }));
  connection.on('error', (error) => logger.warn('RabbitMQ error', { error: error.message }));

  return {
    // Resolves only when the broker confirms it stored the message. Throws while disconnected,
    // so the outbox row stays pending and is retried.
    async publish(routingKey, body, options = {}) {
      if (!publisher) throw new Error('RabbitMQ is not connected');
      publisher.publish(exchange, routingKey, Buffer.from(JSON.stringify(body)), {
        persistent: true,
        contentType: 'application/json',
        ...options
      });
      await publisher.waitForConfirms();
    },
    close: () => connection.close()
  };
}
