// Live updates from the API (Server-Sent Events). Lives next to the other API calls,
// so components never talk to the network themselves.
export const NOTIFICATION_TYPES = ['event-created', 'registration-created'];

// Calls onNotification({ type, data }) for every message. Returns a function that closes the stream.
// EventSource reconnects by itself after a dropped connection (sleeping server, network switch).
export function subscribeToNotifications(onNotification, { url = '/api/notifications' } = {}) {
  const source = new EventSource(url);
  for (const type of NOTIFICATION_TYPES) {
    source.addEventListener(type, (message) => onNotification({ type, data: JSON.parse(message.data) }));
  }
  return () => source.close();
}

// The text a person sees. Never mentions who registered: the API does not even send it.
export function notificationText({ type, data }) {
  if (type === 'event-created') return `New event: ${data.title}`;
  if (type === 'registration-created') return `Someone just registered for ${data.title}`;
  return null;
}
