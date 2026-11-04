import { fileURLToPath } from 'node:url';

if (process.env.NODE_ENV !== 'test') {
  try {
    process.loadEnvFile();
  } catch {
    // no .env
  }
}

const isTest = process.env.NODE_ENV === 'test';
const isProduction = process.env.NODE_ENV === 'production';
const databaseUrl = isTest ? undefined : process.env.DATABASE_URL;
// Tests always use the in-memory cache, like they always use SQLite.
const redisUrl = isTest ? '' : process.env.REDIS_URL || '';

export const env = {
  port: process.env.PORT || 3000,
  logLevel: process.env.LOG_LEVEL || 'info',
  isTest,
  isProduction,
  databaseUrl,
  dbStorage: process.env.DB_STORAGE || './data/events.sqlite',
  // The built Vue app. Served by Express when the folder exists (production, `npm run build`);
  // in development Vite serves it instead. Tests only talk to the API.
  webDist: isTest ? '' : process.env.WEB_DIST || fileURLToPath(new URL('../../../web/dist', import.meta.url)),
  // Empty = no Redis: GET responses are cached in this process's memory instead.
  redisUrl,
  // Safety net: even if an invalidation is missed, a cached response lives at most this long.
  cacheTtlSeconds: Number(process.env.CACHE_TTL_SECONDS) || 60,
  // Empty = no RabbitMQ: the outbox relay then sends mails itself.
  amqpUrl: process.env.AMQP_URL || '',
  // Our own exchange, not the shared class exchange: mails contain email addresses.
  amqpExchange: process.env.AMQP_EXCHANGE || 'campus-events',
  outboxIntervalMs: Number(process.env.OUTBOX_INTERVAL_MS) || 3000,
  mail: {
    // Empty host = development mode: nodemailer builds the mail and we only log it.
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'Campus Events <no-reply@campus-events.local>'
  }
};
