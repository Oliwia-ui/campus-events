import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { createTestApp, validEvent } from '../helpers/testApp.mjs';

const inDays = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

describe('MCP server (POST /api/mcp)', () => {
  let app;
  let nextId = 1;

  // Sends one JSON-RPC request, like an AI assistant would.
  const rpc = (method, params) =>
    request(app).post('/api/mcp').send({ jsonrpc: '2.0', id: nextId++, method, params });

  // Calls a tool and parses the JSON text it returns.
  async function callTool(name, args = {}) {
    const res = await rpc('tools/call', { name, arguments: args });
    assert.equal(res.status, 200);
    const { content, isError } = res.body.result;
    return { data: JSON.parse(content[0].text), isError: isError === true };
  }

  beforeEach(async () => {
    ({ app } = await createTestApp());
  });

  it('answers initialize with its tools capability and the client\'s protocol version', async () => {
    const res = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } });

    assert.equal(res.status, 200);
    assert.equal(res.body.jsonrpc, '2.0');
    assert.equal(res.body.result.protocolVersion, '2025-06-18');
    assert.deepEqual(res.body.result.capabilities, { tools: {} });
    assert.equal(res.body.result.serverInfo.name, 'campus-events');
  });

  it('accepts the initialized notification with 202 and no body', async () => {
    const res = await request(app).post('/api/mcp').send({ jsonrpc: '2.0', method: 'notifications/initialized' });

    assert.equal(res.status, 202);
    assert.equal(res.text, '');
  });

  it('lists the three tools', async () => {
    const res = await rpc('tools/list');

    assert.deepEqual(res.body.result.tools.map((t) => t.name).sort(),
      ['list_past_events', 'list_upcoming_events', 'register_for_event']);
  });

  it('splits events into upcoming and past', async () => {
    await request(app).post('/api/events').send(validEvent({ title: 'Next week', startsAt: inDays(7) }));
    await request(app).post('/api/events').send(validEvent({ title: 'Last week', startsAt: inDays(-7) }));

    const upcoming = await callTool('list_upcoming_events');
    const past = await callTool('list_past_events');

    assert.deepEqual(upcoming.data.map((e) => e.title), ['Next week']);
    assert.deepEqual(past.data.map((e) => e.title), ['Last week']);
  });

  it('registers a person for an event', async () => {
    const event = await request(app).post('/api/events').send(validEvent());

    const result = await callTool('register_for_event', { eventId: event.body.id, name: 'Ada Lovelace', email: 'ada@example.com' });

    assert.equal(result.isError, false);
    assert.equal(result.data.registered, true);
    const list = await request(app).get(`/api/events/${event.body.id}/registrations`);
    assert.deepEqual(list.body.map((r) => r.email), ['ada@example.com']);
  });

  it('returns business errors as a tool error the assistant can read', async () => {
    const event = await request(app).post('/api/events').send(validEvent({ capacity: 1 }));
    await callTool('register_for_event', { eventId: event.body.id, name: 'First', email: 'first@example.com' });

    const full = await callTool('register_for_event', { eventId: event.body.id, name: 'Second', email: 'second@example.com' });
    const unknown = await callTool('register_for_event', { eventId: 999, name: 'Someone', email: 'someone@example.com' });
    const badEmail = await callTool('register_for_event', { eventId: event.body.id, name: 'Third', email: 'not-an-email' });

    assert.equal(full.isError, true);
    assert.match(full.data.error, /full/);
    assert.equal(unknown.isError, true);
    assert.match(unknown.data.error, /not found/);
    assert.equal(badEmail.isError, true);
  });

  it('answers unknown methods and tools with JSON-RPC errors', async () => {
    const method = await rpc('resources/list');
    const tool = await rpc('tools/call', { name: 'delete_everything', arguments: {} });

    assert.equal(method.body.error.code, -32601);
    assert.equal(tool.body.error.code, -32602);
  });

  it('rejects a body that is not a JSON-RPC request', async () => {
    const res = await request(app).post('/api/mcp').send({ hello: 'world' });

    assert.equal(res.body.error.code, -32600);
  });

  it('answers GET with 405, because the server never starts messages itself', async () => {
    const res = await request(app).get('/api/mcp');

    assert.equal(res.status, 405);
    assert.equal(res.headers.allow, 'POST');
  });
});
