import { sequelize } from '../db/connection.mjs';

export const authenticate = () => sequelize.authenticate();
