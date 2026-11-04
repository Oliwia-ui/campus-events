import { Op } from 'sequelize';
import { OutboxMessage } from '../models/index.mjs';

export const add = (type, payload, transaction) => OutboxMessage.create({ type, payload }, { transaction });

// Oldest first, so mails go out in the order people registered.
export const listPending = (limit, maxAttempts) => OutboxMessage.findAll({
  where: { processedAt: { [Op.is]: null }, attempts: { [Op.lt]: maxAttempts } },
  order: [['id', 'ASC']],
  limit
});

export const markProcessed = (id) => OutboxMessage.update({ processedAt: new Date() }, { where: { id } });

// Keep the row (it will be retried) but remember why it failed, for debugging.
export async function recordFailure(id, error) {
  await OutboxMessage.increment('attempts', { where: { id } });
  await OutboxMessage.update({ lastError: String(error).slice(0, 500) }, { where: { id } });
}
