if (process.env.NODE_ENV !== 'test') {
  try {
    process.loadEnvFile();
  } catch {
    // no .env
  }
}

export const env = {
  port: process.env.PORT || 3000,
  logLevel: process.env.LOG_LEVEL || 'info',
  isTest: process.env.NODE_ENV === 'test',
  dbStorage: process.env.DB_STORAGE || './data/events.sqlite'
};
