import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { createTestApp, validEvent } from '../helpers/testApp.mjs';

// The request table from class: every wrong request gets a clear status and error.code.
describe('Request errors', () => {
  let app;

  beforeEach(async () => {
    ({ app } = await createTestApp());
  });

  it('returns 400 with a human message for an id that is not a number', async () => {
    const res = await request(app).get('/api/events/abc');

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    assert.deepEqual(res.body.error.details, [{ field: 'id', message: 'The id must be a positive whole number' }]);
  });

  it('returns 415 when a body is sent without the JSON Content-Type', async () => {
    const created = await request(app).post('/api/events').send(validEvent());

    const res = await request(app)
      .post(`/api/events/${created.body.id}/registrations`)
      .set('Content-Type', 'text/plain')
      .send('{"name":"Ada","email":"ada@example.com"}');

    assert.equal(res.status, 415);
    assert.equal(res.body.error.code, 'UNSUPPORTED_MEDIA_TYPE');
  });

  it('returns 415 when the Content-Type header is missing', async () => {
    const res = await request(app).post('/api/events').unset('Content-Type');

    assert.equal(res.status, 415);
    assert.equal(res.body.error.code, 'UNSUPPORTED_MEDIA_TYPE');
  });

  it('still accepts JSON with a charset', async () => {
    const res = await request(app)
      .post('/api/events')
      .set('Content-Type', 'application/json; charset=utf-8')
      .send(JSON.stringify(validEvent()));

    assert.equal(res.status, 201);
  });

  it('returns 404 NOT_FOUND for /api/registrations, which does not exist', async () => {
    const res = await request(app).get('/api/registrations');

    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'NOT_FOUND');
  });
});
