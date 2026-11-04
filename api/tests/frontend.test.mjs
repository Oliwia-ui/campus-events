import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import request from 'supertest';
import { frontend } from '../src/middleware/frontend.mjs';
import { notFound } from '../src/middleware/errors.mjs';

// The real app only serves web/dist when it has been built, so test the middleware
// on a small app with a fake build folder, mounted in the same order as app.mjs.
describe('Serving the built frontend', () => {
  let dist;
  let app;

  before(() => {
    dist = mkdtempSync(join(tmpdir(), 'campus-dist-'));
    mkdirSync(join(dist, 'assets'));
    writeFileSync(join(dist, 'index.html'), '<div id="app"></div>');
    writeFileSync(join(dist, 'assets', 'index-abc123.js'), 'console.log("app")');
    writeFileSync(join(dist, 'favicon.svg'), '<svg></svg>');

    app = express();
    app.use('/api', express.Router().get('/health', (_req, res) => res.json({ status: 'ok' })));
    app.use(frontend(dist));
    app.use(notFound);
  });

  after(() => rmSync(dist, { recursive: true, force: true }));

  it('serves index.html on /', async () => {
    const res = await request(app).get('/');

    assert.equal(res.status, 200);
    assert.match(res.text, /id="app"/);
  });

  it('serves index.html for a Vue Router page after a refresh, e.g. /events/1', async () => {
    const res = await request(app).get('/events/1');

    assert.equal(res.status, 200);
    assert.match(res.headers['content-type'], /text\/html/);
    assert.equal(res.headers['cache-control'], 'no-cache');
  });

  it('serves built files, hashed assets with a long cache time', async () => {
    const asset = await request(app).get('/assets/index-abc123.js');
    const favicon = await request(app).get('/favicon.svg');

    assert.equal(asset.status, 200);
    assert.match(asset.headers['cache-control'], /max-age=31536000, immutable/);
    assert.equal(favicon.status, 200);
  });

  it('keeps unknown API routes as a JSON 404', async () => {
    const res = await request(app).get('/api/registrations');

    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'NOT_FOUND');
  });

  it('still lets the API answer', async () => {
    const res = await request(app).get('/api/health');

    assert.deepEqual(res.body, { status: 'ok' });
  });

  it('does not treat a path that only starts with "api" as the API', async () => {
    const res = await request(app).get('/apiary');

    assert.match(res.text, /id="app"/);
  });
});
