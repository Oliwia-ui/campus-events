import { subscribe } from '../notifications/hub.mjs';

// Proxies (Render included) close a connection that stays silent for too long.
// A comment line every 25 s keeps it open and is ignored by the browser.
const KEEP_ALIVE_MS = 25_000;

// GET /api/notifications: a Server-Sent Events stream that stays open.
// The browser's EventSource reconnects by itself when the connection drops.
export function stream(req, res) {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    // Stops nginx-style proxies from buffering the stream into one late chunk.
    'X-Accel-Buffering': 'no'
  });
  res.flushHeaders();
  res.write(': connected\n\n');

  const unsubscribe = subscribe({
    send: (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`)
  });
  const keepAlive = setInterval(() => res.write(': keep-alive\n\n'), KEEP_ALIVE_MS);

  req.on('close', () => {
    clearInterval(keepAlive);
    unsubscribe();
  });
}
