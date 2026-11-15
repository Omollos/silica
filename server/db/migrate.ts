import type Database from 'better-sqlite3';
import { SCHEMA_SQL, SCHEMA_VERSION } from './schema';

/**
 * Migrations are idempotent: every statement uses IF NOT EXISTS and the version
 * row is inserted only once, so running this twice is always safe.
 */
export function runMigrations(db: Database.Database): void {
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_SQL);

  const existing = db
    .prepare('SELECT version FROM schema_migrations WHERE version = ?')
    .get(SCHEMA_VERSION) as { version: number } | undefined;

  if (!existing) {
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(
      SCHEMA_VERSION,
      new Date().toISOString()
    );
  }
}
