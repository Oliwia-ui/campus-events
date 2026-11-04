import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { createTestApp, validEvent } from '../helpers/testApp.mjs';

// The GET endpoints are cached. These tests prove the cache is used (X-Cache: HIT)
// and, more importantly, that every write makes the affected responses fresh again.
describe('Caching of GET endpoints', () => {
  let app;

  beforeEach(async () => {
    ({ app } = await createTestApp());
  });

  const createEvent = async (overrides) => (await request(app).post('/api/events').send(validEvent(overrides))).body;
  const register = (id, name) =>
    request(app).post(`/api/events/${id}/registrations`).send({ name, email: `${name.toLowerCase()}@example.com` });

  it('serves the second identical GET from the cache', async () => {
    const event = await createEvent();

    for (const url of ['/api/events', `/api/events/${event.id}`, `/api/events/${event.id}/registrations`, '/api/stats']) {
      const first = await request(app).get(url);
      const second = await request(app).get(url);

      assert.equal(first.headers['x-cache'], 'MISS', url);
      assert.equal(second.headers['x-cache'], 'HIT', url);
      assert.deepEqual(second.body, first.body, url);
    }
  });

  it('shows the new spotsLeft, registrations and stats right after a registration', async () => {
    const event = await createEvent({ capacity: 5 });
    await request(app).get(`/api/events/${event.id}`); // fill the cache
    await request(app).get(`/api/events/${event.id}/registrations`);
    await request(app).get('/api/stats');

    await register(event.id, 'Ada');

    const detail = await request(app).get(`/api/events/${event.id}`);
    const list = await request(app).get(`/api/events/${event.id}/registrations`);
    const stats = await request(app).get('/api/stats');
    assert.equal(detail.body.spotsLeft, 4);
    assert.deepEqual(list.body.map((r) => r.name), ['Ada']);
    assert.equal(stats.body[0].registered, 1);
  });

  it('shows a new event in the list and the stats right away', async () => {
    await createEvent({ title: 'First' });
    await request(app).get('/api/events');
    await request(app).get('/api/stats');

    await createEvent({ title: 'Second' });

    assert.equal((await request(app).get('/api/events')).body.length, 2);
    assert.equal((await request(app).get('/api/stats')).body.length, 2);
  });

  it('shows an update in the detail and the list right away', async () => {
    const event = await createEvent({ title: 'Old title', capacity: 5 });
    await request(app).get(`/api/events/${event.id}`);
    await request(app).get('/api/events');

    await request(app).patch(`/api/events/${event.id}`).send({ title: 'New title', capacity: 8 });

    const detail = await request(app).get(`/api/events/${event.id}`);
    assert.equal(detail.body.title, 'New title');
    assert.equal(detail.body.spotsLeft, 8);
    assert.equal((await request(app).get('/api/events')).body[0].title, 'New title');
  });

  it('returns 404 for a deleted event even if it was cached', async () => {
    const event = await createEvent();
    await request(app).get(`/api/events/${event.id}`);
    await request(app).get(`/api/events/${event.id}/registrations`);

    await request(app).delete(`/api/events/${event.id}`);

    assert.equal((await request(app).get(`/api/events/${event.id}`)).status, 404);
    assert.equal((await request(app).get(`/api/events/${event.id}/registrations`)).status, 404);
    assert.deepEqual((await request(app).get('/api/events')).body, []);
  });

  it('does not cache a 404', async () => {
    await request(app).get('/api/events/1'); // 404, nothing exists yet

    const event = await createEvent();

    assert.equal(event.id, 1);
    assert.equal((await request(app).get('/api/events/1')).status, 200);
  });

  it('does not cache the health check', async () => {
    await request(app).get('/api/health');
    const second = await request(app).get('/api/health');

    assert.equal(second.headers['x-cache'], undefined);
  });
});
