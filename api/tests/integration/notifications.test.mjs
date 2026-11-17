import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { once } from 'node:events';
import { createTestApp, validEvent } from '../helpers/testApp.mjs';
import { clientCount } from '../../src/notifications/hub.mjs';

// A Server-Sent Events stream never ends, so supertest can't wait for it.
// These tests start a real server and read the stream with fetch, like a browser.
describe('Live notifications (GET /api/notifications)', () => {
  let server;
  let baseUrl;

  before(async () => {
    const { app } = await createTestApp();
    server = app.listen(0);
    await once(server, 'listening');
    baseUrl = `http://localhost:${server.address().port}/api`;
  });
  // closeAllConnections: fetch keeps sockets alive, and close() alone would wait for them.
  after(() => {
    server.closeAllConnections();
    server.close();
  });
  beforeEach(() => createTestApp());

  const post = (path, body) => fetch(baseUrl + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  }).then((res) => res.json());

  // Opens a stream and collects every message until close() is called.
  async function openStream() {
    const controller = new AbortController();
    const res = await fetch(`${baseUrl}/notifications`, { signal: controller.signal });
    const messages = [];
    let text = '';
    const reading = (async () => {
      const decoder = new TextDecoder();
      try {
        for await (const chunk of res.body) {
          text += decoder.decode(chunk, { stream: true });
          collect();
        }
      } catch { /* aborted by close() */ }
    })();
    // One SSE message ends with a blank line; comment lines (": ...") carry no event.
    function collect() {
      const blocks = text.split('\n\n');
      text = blocks.pop();
      for (const block of blocks) {
        const type = block.match(/^event: (.*)$/m)?.[1];
        const data = block.match(/^data: (.*)$/m)?.[1];
        if (type) messages.push({ type, data: JSON.parse(data), raw: block });
      }
    }
    // Wait for the ": connected" line so the server has registered this client.
    while (clientCount() === 0) await new Promise((r) => setTimeout(r, 5));
    return { res, messages, close: async () => { controller.abort(); await reading; } };
  }

  const settle = () => new Promise((r) => setTimeout(r, 50));

  it('streams text/event-stream', async () => {
    const stream = await openStream();
    assert.match(stream.res.headers.get('content-type'), /^text\/event-stream/);
    await stream.close();
  });

  it('tells every open browser that a new event was created', async () => {
    const first = await openStream();
    const second = await openStream();

    const event = await post('/events', validEvent({ title: 'Pizza night' }));
    await settle();

    for (const stream of [first, second]) {
      assert.deepEqual(stream.messages.map((m) => m.type), ['event-created']);
      assert.deepEqual(stream.messages[0].data, { eventId: event.id, title: 'Pizza night' });
    }
    await first.close();
    await second.close();
  });

  it('sends exactly one notification per registration, without who registered', async () => {
    const event = await post('/events', validEvent({ title: 'Code dojo' }));
    const stream = await openStream();

    await post(`/events/${event.id}/registrations`, { name: 'Grace Hopper', email: 'grace@example.com' });
    await settle();

    assert.equal(stream.messages.length, 1);
    assert.equal(stream.messages[0].type, 'registration-created');
    assert.deepEqual(stream.messages[0].data, { eventId: event.id, title: 'Code dojo' });
    assert.doesNotMatch(stream.messages[0].raw, /Grace|grace@example\.com/);
    await stream.close();
  });

  it('sends nothing for a registration that fails', async () => {
    const event = await post('/events', validEvent({ capacity: 1 }));
    await post(`/events/${event.id}/registrations`, { name: 'First', email: 'first@example.com' });
    const stream = await openStream();

    await post(`/events/${event.id}/registrations`, { name: 'Second', email: 'second@example.com' });
    await settle();

    assert.deepEqual(stream.messages, []);
    await stream.close();
  });

  it('forgets a browser once its connection closes', async () => {
    const stream = await openStream();
    await stream.close();
    await settle();

    assert.equal(clientCount(), 0);
  });
});
