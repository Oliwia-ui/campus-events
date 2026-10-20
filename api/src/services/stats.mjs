import * as events from '../repositories/events.mjs';
import * as registrations from '../repositories/registrations.mjs';

export async function list() {
  const result = [];
  for (const event of await events.listForStats()) {
    const registered = await registrations.count(event.id);
    const occupancy = event.capacity > 0 ? Math.round((registered / event.capacity) * 100) : 0;
    let status = 'open';
    if (registered >= event.capacity) status = 'full';
    else if (new Date(event.startsAt) < new Date()) status = 'past';
    result.push({ id: event.id, title: event.title, registered, capacity: event.capacity, occupancy: occupancy + '%', status });
  }
  return result;
}
