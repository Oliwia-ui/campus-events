// Moves messages from the outbox table to whatever delivers them (RabbitMQ or the mailer).
// A row is only marked processed AFTER delivery succeeded, so nothing is lost when the
// receiver is down. The price: if the process dies between "delivered" and "marked",
// the message goes out twice (at-least-once delivery). A duplicate mail is better than none.
const FIFTEEN_MINUTES = 15 * 60 * 1000;

// Exponential backoff: wait 2x longer after every failure (3 s, 6 s, 12 s … max 15 min).
// A mail server that is down for hours is not hammered, and the mail still goes out afterwards.
// With maxAttempts 100 a message keeps being retried for about a day.
export function createOutboxRelay({
  outbox, deliver, logger, intervalMs,
  batchSize = 20,
  maxAttempts = 100,
  backoffMs = (attempts) => Math.min(intervalMs * 2 ** attempts, FIFTEEN_MINUTES),
  now = () => new Date()
}) {
  let busy = false;
  let timer;

  async function runOnce() {
    // A slow round (mail server timing out) must not overlap with the next tick.
    if (busy) return 0;
    busy = true;
    let delivered = 0;
    try {
      for (const message of await outbox.listPending(batchSize, maxAttempts, now())) {
        try {
          await deliver(message);
          await outbox.markProcessed(message.id);
          delivered++;
        } catch (error) {
          // Leave the row pending and try again after the backoff. After maxAttempts we stop
          // trying (e.g. an address the server rejects) and the row keeps its lastError.
          const retryInMs = backoffMs(message.attempts);
          await outbox.recordFailure(message.id, error.message, new Date(now().getTime() + retryInMs));
          logger.warn('outbox delivery failed, will retry', { id: message.id, error: error.message, retryInSeconds: Math.round(retryInMs / 1000) });
        }
      }
    } finally {
      busy = false;
    }
    return delivered;
  }

  return {
    runOnce,
    start() {
      timer = setInterval(() => runOnce().catch((error) => logger.error('outbox relay crashed', { error: error.message })), intervalMs);
      timer.unref(); // don't keep the process alive just for this timer
    },
    stop() {
      clearInterval(timer);
    }
  };
}
