import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { spawnSync } from 'node:child_process';

function runConfig(nodeEnv, databaseUrl, script) {
  return spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: new URL('../', import.meta.url),
    env: { ...process.env, NODE_ENV: nodeEnv, DATABASE_URL: databaseUrl },
    encoding: 'utf8'
  });
}

describe('Deployment configuration', () => {
  it('requires a database URL in production instead of ephemeral SQLite', () => {
    const result = runConfig('production', '', 'await import("./src/config/env.mjs");');
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /DATABASE_URL is required in production/);
  });

  it('selects PostgreSQL with a database URL without exposing credentials', () => {
    const result = runConfig('production', 'postgresql://user:password@localhost/campus?sslmode=require', `
      const { sequelize } = await import('./src/db/connection.mjs');
      console.log(sequelize.getDialect());
      await sequelize.close();
    `);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), 'postgres');
    assert.ok(!result.stdout.includes('password'));
  });

  it('keeps tests on SQLite even when a database URL is inherited', () => {
    const result = runConfig('test', 'postgresql://user:password@localhost/campus', `
      const { sequelize } = await import('./src/db/connection.mjs');
      console.log(sequelize.getDialect());
      await sequelize.close();
    `);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), 'sqlite');
  });
});
