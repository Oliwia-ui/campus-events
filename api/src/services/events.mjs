import * as events from '../repositories/events.mjs';
import * as registrations from '../repositories/registrations.mjs';
import { AppError } from '../errors/AppError.mjs';

const missing = (id) => new AppError(404, 'NOT_FOUND', `Event with id ${id} not found`);

export async function requireEvent(id) {
  const event = await events.findById(id);
  if (!event) throw missing(id);
  return event;
}

export const list = () => events.list();
export const create = (data) => events.create(data);

export async function detail(id) {
  const event = await requireEvent(id);
  const count = await registrations.count(id);
  return { ...event.toJSON(), registered: count, spotsLeft: Math.max(event.capacity - count, 0) };
}

export async function update(id, data) {
  const event = await events.update(id, data);
  if (!event) throw missing(id);
  return event;
}

export async function remove(id) {
  if (await events.remove(id) === 0) throw missing(id);
}
