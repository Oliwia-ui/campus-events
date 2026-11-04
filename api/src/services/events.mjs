import * as events from '../repositories/events.mjs';
import * as registrations from '../repositories/registrations.mjs';
import { AppError } from '../errors/AppError.mjs';
import { cache, cacheKeys } from '../cache/index.mjs';

export const missing = (id) => new AppError(404, 'NOT_FOUND', `Event with id ${id} not found`);

export async function requireEvent(id) {
  const event = await events.findById(id);
  if (!event) throw missing(id);
  return event;
}

export const list = () => events.list();

export async function create(data) {
  const event = await events.create(data);
  // A new event appears in the list and in the stats.
  await cache.invalidate([cacheKeys.eventList(), cacheKeys.stats()]);
  return event;
}

export async function detail(id) {
  const event = await requireEvent(id);
  const count = await registrations.count(id);
  return { ...event.toJSON(), registered: count, spotsLeft: Math.max(event.capacity - count, 0) };
}

export async function update(id, data) {
  const event = await events.update(id, data);
  if (!event) throw missing(id);
  // Title, date or capacity changed: list, detail (spotsLeft) and stats are outdated.
  await cache.invalidate([cacheKeys.eventList(), cacheKeys.event(id), cacheKeys.stats()]);
  return event;
}

export async function remove(id) {
  if (await events.remove(id) === 0) throw missing(id);
  // The event and its registrations are gone (cascade delete).
  await cache.invalidate([cacheKeys.eventList(), cacheKeys.event(id), cacheKeys.registrations(id), cacheKeys.stats()]);
}
