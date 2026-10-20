import * as registrations from '../repositories/registrations.mjs';
import { requireEvent } from './events.mjs';
import { AppError } from '../errors/AppError.mjs';
import { logger } from '../config/logger.mjs';

export async function list(eventId) {
  await requireEvent(eventId);
  return registrations.list(eventId);
}

export async function create(eventId, data) {
  const event = await requireEvent(eventId);
  if (await registrations.findByEmail(eventId, data.email)) {
    throw new AppError(409, 'CONFLICT', `${data.email} is already registered for this event`);
  }
  const count = await registrations.count(eventId);
  // Preserve the starter's capacity boundary during this behaviour-only refactor.
  if (count > event.capacity) throw new AppError(409, 'CONFLICT', 'Event is full');
  const registration = await registrations.create({ eventId, name: data.name, email: data.email });
  logger.info('new registration for ' + event.title + ': ' + data.name + ' <' + data.email + '>');
  return registration;
}
