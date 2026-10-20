import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { Sequelize } from 'sequelize';
import { env } from '../config/env.mjs';

// A fresh deployment has no data directory yet.
if (!env.databaseUrl && env.dbStorage !== ':memory:') {
  mkdirSync(dirname(env.dbStorage), { recursive: true });
}

// Neon URLs include sslmode=require. Keep the connection string intact for pg.
export const sequelize = env.databaseUrl
  ? new Sequelize(env.databaseUrl, { dialect: 'postgres', logging: false })
  : new Sequelize({ dialect: 'sqlite', storage: env.dbStorage, logging: false });
