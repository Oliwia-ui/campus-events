import { createLogger, format, transports } from 'winston';
import { env } from './env.mjs';

export const logger = createLogger({
  level: env.logLevel,
  silent: env.isTest,
  format: format.combine(format.timestamp(), format.json()),
  transports: [new transports.Console()]
});

