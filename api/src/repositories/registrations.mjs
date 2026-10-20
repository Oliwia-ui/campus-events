import { Registration } from '../models/index.mjs';

export const count = (eventId) => Registration.count({ where: { eventId } });
export const findByEmail = (eventId, email) => Registration.findOne({ where: { eventId, email } });
export const list = (eventId) => Registration.findAll({ where: { eventId }, order: [['createdAt', 'ASC']] });
export const create = (data) => Registration.create(data);
