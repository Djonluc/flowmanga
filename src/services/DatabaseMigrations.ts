import type Database from '@tauri-apps/plugin-sql';
import { invoke } from '@tauri-apps/api/core';
import { diagnostics } from './DiagnosticsService';

interface Migration {
  version: number;
  name: string;
  run(database: Database): Promise<void>;
}

const columns: Record<string, Array<[string, string]>> = {
  Videos: [['lastPosition', 'REAL DEFAULT 0']],
  Series: [
    ['tags', "TEXT DEFAULT ''"], ['description', 'TEXT'], ['seriesUrl', 'TEXT'], ['mangaId', 'TEXT'],
    ['anilistId', 'TEXT'], ['malId', 'TEXT'], ['kitsuId', 'TEXT'], ['alternativeTitles', 'TEXT'],
    ['japaneseTitle', 'TEXT'], ['englishTitle', 'TEXT'], ['genres', 'TEXT'], ['themes', 'TEXT'],
    ['publisher', 'TEXT'], ['status', 'TEXT'], ['releaseDate', 'TEXT'], ['artist', 'TEXT'],
    ['confidenceScore', 'REAL'], ['contentType', "TEXT DEFAULT 'manga'"], ['providerId', 'TEXT'], ['displayTitle', 'TEXT'],
  ],
  Chapters: [['coverPath', 'TEXT'], ['sourceId', 'TEXT']],
  GalleryImages: [['generalTags', 'TEXT'], ['characterTags', 'TEXT'], ['copyrightTags', 'TEXT'], ['artistTags', 'TEXT'], ['metaTags', 'TEXT']],
  FlowSavedFolders: [['query', 'TEXT']],
  FlowSavedImages: [
    ['artistTags', 'TEXT'], ['characterTags', 'TEXT'], ['copyrightTags', 'TEXT'], ['generalTags', 'TEXT'],
    ['metaTags', 'TEXT'], ['sourceMetadata', 'TEXT'], ['localPath', 'TEXT'], ['mediaType', 'TEXT'], ['sortOrder', 'INTEGER DEFAULT 0'],
  ],
  FlowPlaylists: [['coverUrl', 'TEXT']],
};

function safeIdentifier(value: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error(`Unsafe migration identifier: ${value}`);
  return value;
}

async function ensureColumn(database: Database, table: string, column: string, definition: string): Promise<void> {
  const safeTable = safeIdentifier(table);
  const safeColumn = safeIdentifier(column);
  const current = await database.select<Array<{ name: string }>>(`PRAGMA table_info("${safeTable}")`);
  if (!current.some(item => item.name.toLowerCase() === safeColumn.toLowerCase())) {
    await database.execute(`ALTER TABLE "${safeTable}" ADD COLUMN "${safeColumn}" ${definition}`);
  }
}

const migrations: Migration[] = [
  {
    version: 1,
    name: 'normalize_legacy_columns',
    async run(database) {
      for (const [table, tableColumns] of Object.entries(columns)) {
        for (const [column, definition] of tableColumns) await ensureColumn(database, table, column, definition);
      }
      await database.execute(`
        CREATE TABLE IF NOT EXISTS FlowSeenImages (
          id TEXT PRIMARY KEY, sourceId TEXT, providerId TEXT, seenAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS FlowMediaFingerprints (
          imageId TEXT PRIMARY KEY, providerId TEXT NOT NULL, fingerprint TEXT NOT NULL,
          computedAt DATETIME DEFAULT CURRENT_TIMESTAMP, seenAt DATETIME
        );
        CREATE INDEX IF NOT EXISTS idx_flow_fingerprint_seen ON FlowMediaFingerprints(fingerprint, seenAt);
      `);
    },
  },
  {
    version: 2,
    name: 'provider_diagnostics_and_download_integrity',
    async run(database) {
      await database.execute(`
        CREATE TABLE IF NOT EXISTS ProviderRuntimeState (
          providerId TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'unknown', lastSuccessAt DATETIME,
          lastErrorAt DATETIME, lastError TEXT, authVerifiedAt DATETIME, retryAt DATETIME,
          page INTEGER, cursor TEXT, updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS DownloadIntegrity (
          id TEXT PRIMARY KEY, localPath TEXT NOT NULL UNIQUE, expectedSize INTEGER, actualSize INTEGER,
          checksum TEXT, status TEXT NOT NULL DEFAULT 'unknown', checkedAt DATETIME
        );
      `);
    },
  },
];

export async function runDatabaseMigrations(database: Database): Promise<void> {
  await database.execute(`CREATE TABLE IF NOT EXISTS SchemaMigrations (
    version INTEGER PRIMARY KEY, name TEXT NOT NULL, appliedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  const appliedRows = await database.select<Array<{ version: number }>>('SELECT version FROM SchemaMigrations');
  const applied = new Set(appliedRows.map(row => Number(row.version)));
  const pending = migrations.filter(migration => !applied.has(migration.version));
  if (pending.length === 0) return;

  await database.execute('PRAGMA wal_checkpoint(FULL)');
  try {
    const backupPath = await invoke<string>('backup_database');
    diagnostics.log('info', 'database', `Pre-migration backup created: ${backupPath}`);
  } catch (error) {
    diagnostics.log('warning', 'database', 'Could not create the automatic pre-migration backup', { details: { error: String(error) } });
    throw new Error(`Database migration stopped because its safety backup failed: ${String(error)}`);
  }

  for (const migration of pending) {
    await database.execute('BEGIN IMMEDIATE');
    try {
      await migration.run(database);
      await database.execute('INSERT INTO SchemaMigrations (version, name) VALUES (?, ?)', [migration.version, migration.name]);
      await database.execute('COMMIT');
      diagnostics.log('info', 'database', `Applied migration ${migration.version}: ${migration.name}`);
    } catch (error) {
      await database.execute('ROLLBACK');
      diagnostics.log('error', 'database', `Migration ${migration.version} failed`, { details: { error: String(error) } });
      throw new Error(`Database migration ${migration.version} (${migration.name}) failed: ${String(error)}`);
    }
  }
}

export const databaseMigrationCount = migrations.length;
