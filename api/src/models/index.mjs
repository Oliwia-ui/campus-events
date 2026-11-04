import { DataTypes } from 'sequelize';
import { sequelize } from '../db/connection.mjs';

export const Event = sequelize.define('Event', {
  title: { type: DataTypes.STRING(120), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  location: { type: DataTypes.STRING(120), allowNull: false },
  startsAt: { type: DataTypes.DATE, allowNull: false },
  capacity: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1 } }
});

export const Registration = sequelize.define('Registration', {
  name: { type: DataTypes.STRING(100), allowNull: false },
  email: { type: DataTypes.STRING(254), allowNull: false }
});

// Transactional outbox: a "to do" list of messages, saved in the same transaction as the
// change that caused them. If the mail provider or RabbitMQ is down, the row simply waits.
export const OutboxMessage = sequelize.define('OutboxMessage', {
  type: { type: DataTypes.STRING(60), allowNull: false },
  payload: { type: DataTypes.JSON, allowNull: false },
  // null = still to deliver; filled in once delivered.
  processedAt: { type: DataTypes.DATE, allowNull: true },
  attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  lastError: { type: DataTypes.STRING(500), allowNull: true }
});

Event.hasMany(Registration, { foreignKey: { name: 'eventId', allowNull: false }, onDelete: 'CASCADE' });
Registration.belongsTo(Event, { foreignKey: 'eventId' });

