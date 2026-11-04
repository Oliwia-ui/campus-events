import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { createTestApp, validEvent } from '../helpers/testApp.mjs';

// Behaviour change: an event never accepts more registrations than its capacity,
// not even when many people press "register" at the same moment.
describe('Event capacity', () => {
  let app;

  beforeEach(async () => {
    ({ app } = await createTestApp());
  });

  const createEvent = async (capacity) =>
    (await request(app).post('/api/events').send(validEvent({ capacity }))).body.id;

  const register = (id, n) =>
    request(app).post(`/api/events/${id}/registrations`).send({ name: `Person ${n}`, email: `person${n}@example.com` });

  it('accepts exactly `capacity` registrations and refuses the next one', async () => {
    const id = await createEvent(2);

    const first = await register(id, 1);
    const second = await register(id, 2);
    const third = await register(id, 3);

    assert.deepEqual([first.status, second.status, third.status], [201, 201, 409]);
    assert.equal(third.body.error.code, 'CONFLICT');
    assert.equal(third.body.error.message, 'Event is full');
  });

  it('never overbooks when registrations arrive at the same time', async () => {
    const id = await createEvent(3);

    const responses = await Promise.all(Array.from({ length: 10 }, (_, n) => register(id, n)));
    const event = await request(app).get(`/api/events/${id}`);

    assert.equal(responses.filter((res) => res.status === 201).length, 3);
    assert.equal(responses.filter((res) => res.status === 409).length, 7);
    assert.equal(event.body.registered, 3);
    assert.equal(event.body.spotsLeft, 0);
  });

  it('accepts the same email only once when it is sent twice at the same time', async () => {
    const id = await createEvent(10);
    const url = `/api/events/${id}/registrations`;
    const ada = { name: 'Ada', email: 'ada@example.com' };

    const responses = await Promise.all([request(app).post(url).send(ada), request(app).post(url).send(ada)]);

    assert.deepEqual(responses.map((res) => res.status).sort(), [201, 409]);
  });
});
