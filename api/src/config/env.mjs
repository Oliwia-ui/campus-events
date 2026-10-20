if (process.env.NODE_ENV !== 'test') {
  try {
    process.loadEnvFile();
  } catch {
    // no .env
  }
}

const isTest = process.env.NODE_ENV === 'test';
const isProduction = process.env.NODE_ENV === 'production';
const databaseUrl = isTest ? undefined : process.env.DATABASE_URL;

export const env = {
  port: process.env.PORT || 3000,
  logLevel: process.env.LOG_LEVEL || 'info',
  isTest,
  isProduction,
  databaseUrl,
  dbStorage: process.env.DB_STORAGE || './data/events.sqlite'
};
