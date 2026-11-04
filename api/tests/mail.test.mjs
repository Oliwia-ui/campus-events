import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { createTestApp, validEvent } from './helpers/testApp.mjs';
import { OutboxMessage } from '../src/models/index.mjs';
import * as outbox from '../src/repositories/outbox.mjs';
import { createOutboxRelay } from '../src/messaging/outboxRelay.mjs';
import { createMailConsumer } from '../src/messaging/mailConsumer.mjs';
import { registrationMail } from '../src/mail/registrationMail.mjs';
import { REGISTRATION_CREATED } from '../src/messaging/messageTypes.mjs';

const silentLogger = { info() {}, warn() {}, error() {} };
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('Confirmation mail', () => {
  let app;

  beforeEach(async () => {
    ({ app } = await createTestApp());
  });

  async function registerAda() {
    const created = await request(app).post('/api/events').send(validEvent({ title: 'Backend Bootcamp' }));
    return request(app).post(`/api/events/${created.body.id}/registrations`).send({ name: 'Ada', email: 'ada@example.com' });
  }

  // backoffMs 0: these tests retry straight away; the backoff has its own test below.
  const relayWith = (deliver) =>
    createOutboxRelay({ outbox, deliver, logger: silentLogger, intervalMs: 1000, backoffMs: () => 0 });

  it('stores a mail job in the outbox together with the registration', async () => {
    const res = await registerAda();
    const jobs = await OutboxMessage.findAll();

    assert.equal(res.status, 201);
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].type, REGISTRATION_CREATED);
    assert.equal(jobs[0].payload.email, 'ada@example.com');
    assert.equal(jobs[0].payload.event.title, 'Backend Bootcamp');
    assert.equal(jobs[0].processedAt, null);
  });

  it('stores no mail job when the registration is refused', async () => {
    const first = await registerAda();

    const duplicate = await request(app)
      .post(`/api/events/${first.body.eventId}/registrations`)
      .send({ name: 'Ada', email: 'ada@example.com' });

    assert.equal(duplicate.status, 409);
    assert.equal(await OutboxMessage.count(), 1);
  });

  it('keeps the registration and the mail job when the mail provider is down', async () => {
    const res = await registerAda();
    const relay = relayWith(async () => { throw new Error('SMTP connection refused'); });

    const delivered = await relay.runOnce();
    const [job] = await OutboxMessage.findAll();
    const registrations = await request(app).get(`/api/events/${res.body.eventId}/registrations`);

    assert.equal(res.status, 201);
    assert.equal(delivered, 0);
    assert.equal(registrations.body.length, 1);
    assert.equal(job.processedAt, null);
    assert.equal(job.attempts, 1);
    assert.equal(job.lastError, 'SMTP connection refused');
  });

  it('sends the mail on a later round once the provider is back', async () => {
    await registerAda();
    const sent = [];
    let providerUp = false;
    const relay = relayWith(async (message) => {
      if (!providerUp) throw new Error('offline');
      sent.push(message.payload.email);
    });

    await relay.runOnce();
    providerUp = true;
    await relay.runOnce();
    await relay.runOnce(); // already processed: must not send twice

    assert.deepEqual(sent, ['ada@example.com']);
    assert.notEqual((await OutboxMessage.findOne()).processedAt, null);
  });

  it('gives up on a message after maxAttempts', async () => {
    await registerAda();
    let calls = 0;
    const relay = createOutboxRelay({
      outbox, logger: silentLogger, intervalMs: 1000, maxAttempts: 2, backoffMs: () => 0,
      deliver: async () => { calls++; throw new Error('rejected'); }
    });

    await relay.runOnce();
    await relay.runOnce();
    await relay.runOnce();

    assert.equal(calls, 2);
  });
});

describe('Outbox retry backoff', () => {
  beforeEach(async () => {
    await createTestApp();
  });

  it('waits longer after every failure instead of retrying every tick', async () => {
    await outbox.add(REGISTRATION_CREATED, { email: 'ada@example.com' });
    let clock = new Date('2026-11-04T12:00:00Z');
    let calls = 0;
    const relay = createOutboxRelay({
      outbox, logger: silentLogger, intervalMs: 3000, now: () => clock,
      deliver: async () => { calls++; throw new Error('offline'); }
    });
    const after = async (ms) => { clock = new Date(clock.getTime() + ms); await relay.runOnce(); };

    await relay.runOnce();   // attempt 1 fails → next try in 3 s
    await after(1000);       // too early: skipped
    await after(2000);       // 3 s later: attempt 2 fails → next try in 6 s
    await after(5000);       // too early: skipped
    await after(1000);       // 6 s later: attempt 3

    assert.equal(calls, 3);
    const job = await OutboxMessage.findOne();
    assert.equal(job.attempts, 3);
    assert.equal(job.nextAttemptAt.getTime() - clock.getTime(), 12_000);
  });

  it('never waits more than 15 minutes between attempts', async () => {
    await outbox.add(REGISTRATION_CREATED, { email: 'ada@example.com' });
    await OutboxMessage.update({ attempts: 30 }, { where: {} });
    const clock = new Date('2026-11-04T12:00:00Z');
    const relay = createOutboxRelay({
      outbox, logger: silentLogger, intervalMs: 3000, now: () => clock,
      deliver: async () => { throw new Error('offline'); }
    });

    await relay.runOnce();

    const job = await OutboxMessage.findOne();
    assert.equal(job.nextAttemptAt.getTime() - clock.getTime(), 15 * 60 * 1000);
  });
});

describe('Mail consumer', () => {
  const fakeChannel = () => {
    const calls = [];
    return { calls, ack: (msg) => calls.push(['ack', msg.id]), nack: (msg, _all, requeue) => calls.push(['nack', msg.id, requeue]) };
  };
  const message = (body) => ({ id: 1, content: Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)) });
  const payload = { name: 'Ada', email: 'ada@example.com', event: { title: 'Bootcamp', location: 'C101', startsAt: '2026-12-01T13:00:00Z' } };

  it('acks only after the mail was sent', async () => {
    const channel = fakeChannel();
    const sent = [];
    const onMessage = createMailConsumer({ sendMail: async (p) => sent.push(p.email), logger: silentLogger });

    await onMessage(channel, message(payload));

    assert.deepEqual(sent, ['ada@example.com']);
    assert.deepEqual(channel.calls, [['ack', 1]]);
  });

  it('puts the message back on the queue when sending fails', async () => {
    const channel = fakeChannel();
    const onMessage = createMailConsumer({
      sendMail: async () => { throw new Error('offline'); },
      logger: silentLogger,
      retryDelayMs: 5
    });

    await onMessage(channel, message(payload));
    assert.deepEqual(channel.calls, []); // not immediately: it waits first
    await wait(20);

    assert.deepEqual(channel.calls, [['nack', 1, true]]);
  });

  it('drops a message that is not valid JSON instead of retrying it forever', async () => {
    const channel = fakeChannel();
    const onMessage = createMailConsumer({ sendMail: async () => {}, logger: silentLogger });

    await onMessage(channel, message('{ not json'));

    assert.deepEqual(channel.calls, [['nack', 1, false]]);
  });
});

describe('Registration mail text', () => {
  it('is addressed to the participant and names the event', () => {
    const mail = registrationMail({
      name: 'Ada',
      email: 'ada@example.com',
      event: { title: 'Backend Bootcamp', location: 'Room C101', startsAt: '2026-12-01T13:00:00Z' }
    });

    assert.equal(mail.to, 'ada@example.com');
    assert.equal(mail.subject, "You're registered: Backend Bootcamp");
    assert.match(mail.text, /Hi Ada/);
    assert.match(mail.text, /Room C101/);
    assert.match(mail.text, /14:00/); // 13:00 UTC is 14:00 in Brussels in winter
  });
});
