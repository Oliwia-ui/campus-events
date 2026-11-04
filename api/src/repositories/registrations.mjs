import { Registration } from '../models/index.mjs';

// `transaction` is optional: pass it to run the query inside a transaction.
export const count = (eventId, transaction) => Registration.count({ where: { eventId }, transaction });
export const findByEmail = (eventId, email, transaction) =>
  Registration.findOne({ where: { eventId, email }, transaction });
export const list = (eventId) => Registration.findAll({ where: { eventId }, order: [['createdAt', 'ASC']] });
export const create = (data, transaction) => Registration.create(data, { transaction });
