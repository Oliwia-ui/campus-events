// Keeps every open browser connection (Server-Sent Events) in this process and sends
// each notification to all of them. Plain Node, no Express: services can publish to it.
const clients = new Set();

export const NOTIFICATION_TYPES = Object.freeze({
  EVENT_CREATED: 'event-created',
  REGISTRATION_CREATED: 'registration-created'
});

// `client` is anything with send(type, data); the controller wraps the HTTP response.
export function subscribe(client) {
  clients.add(client);
  return () => clients.delete(client);
}

export function publish(type, data) {
  for (const client of clients) client.send(type, data);
}

export const clientCount = () => clients.size;
