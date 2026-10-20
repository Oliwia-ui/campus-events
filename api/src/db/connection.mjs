import { Sequelize } from 'sequelize';
import { env } from '../config/env.mjs';

// Neon URLs include sslmode=require. Keep the connection string intact for pg.
export const sequelize = env.databaseUrl
  ? new Sequelize(env.databaseUrl, { dialect: 'postgres', logging: false })
  : new Sequelize({ dialect: 'sqlite', storage: env.dbStorage, logging: false });
