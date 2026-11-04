import { sequelize } from '../db/connection.mjs';

// Runs `work` inside one database transaction: Sequelize commits when it finishes
// and rolls everything back when it throws. Services receive the transaction as an
// opaque value and only pass it on to repositories, so they never touch Sequelize.
export const inTransaction = (work) => sequelize.transaction((transaction) => work(transaction));
