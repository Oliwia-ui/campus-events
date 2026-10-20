import express from 'express';
import { router } from './routes/index.mjs';
import { requestLogger } from './middleware/requestLogger.mjs';
import { notFound, errorHandler } from './middleware/errors.mjs';

// Keep the existing public exports for scripts and integration-test consumers.
export { sequelize } from './db/connection.mjs';
export { Event, Registration } from './models/index.mjs';
export { seedDemoData } from './db/demoData.mjs';

export const app = express();
app.use(express.json());
app.use(requestLogger);
app.use('/api', router);
app.use(notFound);
app.use(errorHandler);
