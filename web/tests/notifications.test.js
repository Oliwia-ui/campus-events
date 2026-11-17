import { afterEach, describe, expect, it, vi } from 'vitest';
import { subscribeToNotifications, notificationText } from '../src/api/notifications.js';

// A fake EventSource: records listeners so the test can "send" a server message.
class FakeEventSource {
  static last;
  constructor(url) {
    this.url = url;
    this.listeners = {};
    this.closed = false;
    FakeEventSource.last = this;
  }
  addEventListener(type, listener) { this.listeners[type] = listener; }
  close() { this.closed = true; }
  emit(type, data) { this.listeners[type]({ data: JSON.stringify(data) }); }
}

describe('notifications', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('opens /api/notifications and passes on every message', () => {
    vi.stubGlobal('EventSource', FakeEventSource);
    const received = [];

    subscribeToNotifications((n) => received.push(n));
    FakeEventSource.last.emit('event-created', { eventId: 1, title: 'Pizza night' });
    FakeEventSource.last.emit('registration-created', { eventId: 1, title: 'Pizza night' });

    expect(FakeEventSource.last.url).toBe('/api/notifications');
    expect(received.map((n) => n.type)).toEqual(['event-created', 'registration-created']);
  });

  it('closes the stream when unsubscribed', () => {
    vi.stubGlobal('EventSource', FakeEventSource);

    const unsubscribe = subscribeToNotifications(() => {});
    unsubscribe();

    expect(FakeEventSource.last.closed).toBe(true);
  });

  it('turns messages into text that never says who registered', () => {
    expect(notificationText({ type: 'event-created', data: { title: 'Pizza night' } })).toBe('New event: Pizza night');
    expect(notificationText({ type: 'registration-created', data: { title: 'Code dojo' } }))
      .toBe('Someone just registered for Code dojo');
    expect(notificationText({ type: 'unknown', data: {} })).toBeNull();
  });
});
