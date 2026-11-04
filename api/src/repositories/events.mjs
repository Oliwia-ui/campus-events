import { Event } from '../models/index.mjs';

export const list = () => Event.findAll({ order: [['startsAt', 'ASC']] });
export const listForStats = () => Event.findAll();
export const findById = (id) => Event.findByPk(id);
// Postgres: SELECT ... FOR UPDATE makes a second transaction wait until this one is done,
// which protects capacity even with several API servers. SQLite has no row locks and ignores it.
export const findByIdForUpdate = (id, transaction) =>
  Event.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
export const create = (data) => Event.create(data);
export async function update(id, data) {
  const event = await Event.findByPk(id);
  if (!event) return null;
  return event.update(data);
}
export const remove = (id) => Event.destroy({ where: { id } });
