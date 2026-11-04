import { app } from './app.mjs';
import { Event } from './models/index.mjs';
import { sequelize } from './db/connection.mjs';
import { seedDemoData } from './db/demoData.mjs';
import { env } from './config/env.mjs';
import { logger } from './config/logger.mjs';
import { startMessaging } from './messaging/index.mjs';

await sequelize.sync();

// First start on a fresh clone: fill the empty database so the UI has something to show.
if ((await Event.count()) === 0) {
  await seedDemoData();
  console.log('Empty database – demo data added');
}

const messaging = await startMessaging();

const port = env.port;
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Campus Events API running on http://localhost:${port}/api`);
});

// Render (and Docker) send SIGTERM before stopping the container: finish cleanly.
// Unsent mails stay in the outbox and go out after the next start.
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down');
  server.close();
  await messaging.stop();
  await sequelize.close();
  process.exit(0);
});
