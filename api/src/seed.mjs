// `npm run seed`: wipes the database and fills it with demo data again.
import { seedDemoData } from './db/demoData.mjs';
import { sequelize } from './db/connection.mjs';

await sequelize.sync({ force: true });
await seedDemoData();

console.log('Database reset with demo data.');
await sequelize.close();
