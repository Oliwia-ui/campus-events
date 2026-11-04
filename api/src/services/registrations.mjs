import * as events from '../repositories/events.mjs';
import * as registrations from '../repositories/registrations.mjs';
import * as outbox from '../repositories/outbox.mjs';
import { inTransaction } from '../repositories/transaction.mjs';
import { requireEvent, missing } from './events.mjs';
import { AppError } from '../errors/AppError.mjs';
import { createSerialQueue } from '../utils/serialQueue.mjs';
import { logger } from '../config/logger.mjs';
import { REGISTRATION_CREATED } from '../messaging/messageTypes.mjs';

// One registration at a time in this process (see utils/serialQueue.mjs).
const oneAtATime = createSerialQueue();

export async function list(eventId) {
  await requireEvent(eventId);
  return registrations.list(eventId);
}

export function create(eventId, data) {
  return oneAtATime(() => inTransaction(async (transaction) => {
    const event = await events.findByIdForUpdate(eventId, transaction);
    if (!event) throw missing(eventId);
    if (await registrations.findByEmail(eventId, data.email, transaction)) {
      throw new AppError(409, 'CONFLICT', `${data.email} is already registered for this event`);
    }
    // `>=`: with capacity 2 and 2 registrations the event is full.
    if (await registrations.count(eventId, transaction) >= event.capacity) {
      throw new AppError(409, 'CONFLICT', 'Event is full');
    }
    const registration = await registrations.create({ eventId, name: data.name, email: data.email }, transaction);
    // Same transaction: the registration and "send the confirmation mail" are saved together
    // or not at all. Sending happens later (messaging/), so a broken mail server can't fail this request.
    await outbox.add(REGISTRATION_CREATED, {
      registrationId: registration.id,
      name: registration.name,
      email: registration.email,
      event: { id: event.id, title: event.title, location: event.location, startsAt: event.startsAt }
    }, transaction);
    // Log the event id, not the email: logs should not collect personal data.
    logger.info('new registration', { eventId, registrationId: registration.id });
    return registration;
  }));
}
