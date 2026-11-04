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
  : new Sequelize({
    dialect: 'sqlite',
    storage: env.dbStorage,
    logging: false,
    // SQLite allows one writer at a time. IMMEDIATE takes the write lock when a transaction
    // starts, so two writers can't deadlock; a write that finds the lock taken waits and
    // retries instead of failing with "SQLITE_BUSY: database is locked".
    transactionType: 'IMMEDIATE',
    retry: { match: [/SQLITE_BUSY/], max: 10 }
  });
