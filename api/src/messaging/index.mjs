import * as outbox from '../repositories/outbox.mjs';
import { env } from '../config/env.mjs';
import { logger } from '../config/logger.mjs';
import { createMailer } from '../mail/mailer.mjs';
import { registrationMail } from '../mail/registrationMail.mjs';
import { createOutboxRelay } from './outboxRelay.mjs';
import { createMailConsumer } from './mailConsumer.mjs';
import { connectRabbit } from './rabbit.mjs';
import { REGISTRATION_CREATED } from './messageTypes.mjs';

// Started by server.mjs only, never by app.mjs: tests import the app without background work.
export async function startMessaging() {
  const mailer = createMailer(env.mail, logger);
  const sendMail = (payload) => mailer.send(registrationMail(payload));

  let rabbit = null;
  let deliver;
  if (env.amqpUrl) {
    // relay → RabbitMQ → mail consumer. The broker spreads the mails over consumers
    // and keeps them safe while the consumer or the mail server is down.
    rabbit = await connectRabbit({
      url: env.amqpUrl,
      exchange: env.amqpExchange,
      logger,
      onMailMessage: createMailConsumer({ sendMail, logger })
    });
    deliver = (message) => rabbit.publish(message.type, message.payload, { messageId: String(message.id) });
  } else {
    // No broker configured: the relay sends the mail itself. Same guarantee: retried until it works.
    deliver = (message) => {
      if (message.type !== REGISTRATION_CREATED) throw new Error(`No handler for ${message.type}`);
      return sendMail(message.payload);
    };
  }

  const relay = createOutboxRelay({ outbox, deliver, logger, intervalMs: env.outboxIntervalMs });
  relay.start();
  logger.info('messaging started', { rabbitmq: Boolean(rabbit), smtp: Boolean(env.mail.host) });

  return {
    async stop() {
      relay.stop();
      await rabbit?.close();
    }
  };
}
