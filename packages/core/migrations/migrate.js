#!/usr/bin/env node
/**
 * MSE Database Migration Runner
 *
 * Executes SQL migration files in numeric order, then seed data.
 * Tracks applied migrations in a `mse_migrations` table to avoid re-running.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." node migrations/migrate.js
 *   DATABASE_URL="postgresql://..." node migrations/migrate.js --seed-only
 *   DATABASE_URL="postgresql://..." node migrations/migrate.js --status
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = __dirname;
const SEED_DIR = path.join(__dirname, 'seed');

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('Error: DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const seedOnly = args.includes('--seed-only');
  const statusOnly = args.includes('--status');

  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();

    // Ensure migrations tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS mse_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    if (statusOnly) {
      await showStatus(client);
      return;
    }

    if (!seedOnly) {
      await runMigrations(client);
    }

    await runSeedData(client);

    console.log('\nDone.');
  } catch (error) {
    console.error('\nMigration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

/**
 * Run core schema migrations (001_*.sql, 002_*.sql, etc.)
 */
async function runMigrations(client) {
  const files = getSQLFiles(MIGRATIONS_DIR);

  if (files.length === 0) {
    console.log('No migration files found.');
    return;
  }

  console.log(`Found ${files.length} migration(s).\n`);

  const applied = await getAppliedMigrations(client);
  let newCount = 0;

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`  skip  ${file} (already applied)`);
      continue;
    }

    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, 'utf8');

    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO mse_migrations (filename) VALUES ($1)',
        [file]
      );
      await client.query('COMMIT');
      console.log(`  apply ${file}`);
      newCount++;
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`  FAIL  ${file}: ${error.message}`);
      throw error;
    }
  }

  if (newCount === 0) {
    console.log('All migrations already applied.');
  } else {
    console.log(`\nApplied ${newCount} new migration(s).`);
  }
}

/**
 * Run seed data files (idempotent — uses INSERT ... ON CONFLICT)
 */
async function runSeedData(client) {
  if (!fs.existsSync(SEED_DIR)) {
    console.log('No seed directory found, skipping.');
    return;
  }

  const files = getSQLFiles(SEED_DIR);
  if (files.length === 0) {
    console.log('No seed files found.');
    return;
  }

  console.log(`\nLoading ${files.length} seed file(s)...\n`);

  for (const file of files) {
    const filePath = path.join(SEED_DIR, file);
    const sql = fs.readFileSync(filePath, 'utf8');

    try {
      await client.query(sql);
      console.log(`  seed  ${file}`);
    } catch (error) {
      console.error(`  FAIL  ${file}: ${error.message}`);
      throw error;
    }
  }
}

/**
 * Show migration status
 */
async function showStatus(client) {
  const applied = await getAppliedMigrations(client);
  const files = getSQLFiles(MIGRATIONS_DIR);

  console.log('Migration status:\n');
  for (const file of files) {
    const status = applied.has(file) ? 'applied' : 'PENDING';
    console.log(`  [${status}] ${file}`);
  }

  const pending = files.filter(f => !applied.has(f));
  console.log(`\n${applied.size} applied, ${pending.length} pending.`);
}

/**
 * Get set of already-applied migration filenames
 */
async function getAppliedMigrations(client) {
  try {
    const result = await client.query('SELECT filename FROM mse_migrations ORDER BY id');
    return new Set(result.rows.map(r => r.filename));
  } catch {
    // Table might not exist yet on first run
    return new Set();
  }
}

/**
 * Get sorted .sql files from a directory
 */
function getSQLFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.sql'))
    .sort();
}

main();
