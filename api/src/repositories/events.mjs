import { Event } from '../models/index.mjs';

export const list = () => Event.findAll({ order: [['startsAt', 'ASC']] });
export const listForStats = () => Event.findAll();
export const findById = (id) => Event.findByPk(id);
export const create = (data) => Event.create(data);
export async function update(id, data) {
  const event = await Event.findByPk(id);
  if (!event) return null;
  return event.update(data);
}
export const remove = (id) => Event.destroy({ where: { id } });
