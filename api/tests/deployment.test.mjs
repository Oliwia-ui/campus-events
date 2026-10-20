import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function runConfig(nodeEnv, databaseUrl, script, overrides = {}) {
  return spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: new URL('../', import.meta.url),
    env: { ...process.env, NODE_ENV: nodeEnv, DATABASE_URL: databaseUrl, ...overrides },
    encoding: 'utf8'
  });
}

describe('Deployment configuration', () => {
  it('starts production with SQLite and creates its missing data directory', () => {
    const directory = mkdtempSync(join(tmpdir(), 'campus-sqlite-'));
    try {
      const result = runConfig('production', '', `
        const { sequelize, Event, seedDemoData } = await import('./src/app.mjs');
        await sequelize.sync();
        await seedDemoData();
        console.log(sequelize.getDialect(), await Event.count());
        await sequelize.close();
      `, { DB_STORAGE: join(directory, 'data/events.sqlite') });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), 'sqlite 4');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
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
