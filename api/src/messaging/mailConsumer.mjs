// Handles one RabbitMQ message: send the confirmation mail, then ack.
// ack = "done, delete it". Until we ack, RabbitMQ keeps the message and redelivers it
// if this process crashes, so a mail is never lost halfway.
export function createMailConsumer({ sendMail, logger, retryDelayMs = 10_000 }) {
  return async function onMessage(channel, msg) {
    if (!msg) return; // the broker cancelled the consumer (e.g. queue deleted)

    let payload;
    try {
      payload = JSON.parse(msg.content.toString());
    } catch {
      // Unreadable message: retrying will never fix it, so drop it instead of looping forever.
      logger.error('mail consumer: invalid message dropped');
      channel.nack(msg, false, false);
      return;
    }

    try {
      await sendMail(payload);
      channel.ack(msg);
    } catch (error) {
      logger.warn('mail consumer: sending failed, message goes back to the queue', { error: error.message });
      // Wait before requeueing: putting it back immediately would hammer a mail server that is down.
      setTimeout(() => {
        try {
          channel.nack(msg, false, true);
        } catch {
          // Channel already closed: RabbitMQ requeues unacked messages by itself.
        }
      }, retryDelayMs).unref();
    }
  };
}
