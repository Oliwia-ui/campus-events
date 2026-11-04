// Moves messages from the outbox table to whatever delivers them (RabbitMQ or the mailer).
// A row is only marked processed AFTER delivery succeeded, so nothing is lost when the
// receiver is down. The price: if the process dies between "delivered" and "marked",
// the message goes out twice (at-least-once delivery). A duplicate mail is better than none.
export function createOutboxRelay({ outbox, deliver, logger, intervalMs, batchSize = 20, maxAttempts = 20 }) {
  let busy = false;
  let timer;

  async function runOnce() {
    // A slow round (mail server timing out) must not overlap with the next tick.
    if (busy) return 0;
    busy = true;
    let delivered = 0;
    try {
      for (const message of await outbox.listPending(batchSize, maxAttempts)) {
        try {
          await deliver(message);
          await outbox.markProcessed(message.id);
          delivered++;
        } catch (error) {
          // Leave the row pending; the next round tries again. After maxAttempts we stop
          // trying (e.g. an address the server rejects) and the row keeps its lastError.
          await outbox.recordFailure(message.id, error.message);
          logger.warn('outbox delivery failed, will retry', { id: message.id, error: error.message });
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
