import express from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { router } from './routes/index.mjs';
import { requireJson } from './middleware/requireJson.mjs';
import { requestLogger } from './middleware/requestLogger.mjs';
import { notFound, errorHandler } from './middleware/errors.mjs';
import { frontend } from './middleware/frontend.mjs';
import { env } from './config/env.mjs';

// Keep the existing public exports for scripts and integration-test consumers.
export { sequelize } from './db/connection.mjs';
export { Event, Registration } from './models/index.mjs';
export { seedDemoData } from './db/demoData.mjs';

export const app = express();
app.use(express.json());
app.use(requestLogger);
app.use('/api', requireJson, router);
if (env.webDist && existsSync(join(env.webDist, 'index.html'))) app.use(frontend(env.webDist));
app.use(notFound);
app.use(errorHandler);
