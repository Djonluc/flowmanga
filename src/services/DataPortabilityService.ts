import { getDb } from './db';
import { diagnostics } from './DiagnosticsService';

interface FlowMangaBackup {
  format: 'flowmanga-backup';
  version: 1;
  createdAt: string;
  appVersion: string;
  settings: unknown;
  tables: Record<string, Array<Record<string, unknown>>>;
}

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function assertSqlIdentifier(value: string): string {
  if (!IDENTIFIER.test(value)) throw new Error(`Unsafe database identifier: ${value}`);
  return value;
}

function settingsWithoutCredentials(): unknown {
  try {
    const raw = globalThis.localStorage?.getItem('flowmanga-settings');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: Record<string, unknown> };
    if (parsed.state) {
      parsed.state = { ...parsed.state, booruAuth: {} };
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function createFlowMangaBackup(): Promise<string> {
  const database = getDb();
  const tableRows = await database.select<Array<{ name: string }>>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  const tables: FlowMangaBackup['tables'] = {};
  for (const { name } of tableRows) {
    const safeName = assertSqlIdentifier(name);
    tables[safeName] = await database.select<Array<Record<string, unknown>>>(`SELECT * FROM "${safeName}"`);
  }
  const backup: FlowMangaBackup = {
    format: 'flowmanga-backup',
    version: 1,
    createdAt: new Date().toISOString(),
    appVersion: '2.5.3',
    settings: settingsWithoutCredentials(),
    tables,
  };
  diagnostics.log('info', 'backup', `Created backup containing ${Object.keys(tables).length} tables`);
  return JSON.stringify(backup, null, 2);
}

export function parseFlowMangaBackup(raw: string): FlowMangaBackup {
  const parsed = JSON.parse(raw) as Partial<FlowMangaBackup>;
  if (parsed.format !== 'flowmanga-backup' || parsed.version !== 1 || !parsed.tables || typeof parsed.tables !== 'object') {
    throw new Error('This is not a supported FlowManga backup.');
  }
  for (const [table, rows] of Object.entries(parsed.tables)) {
    assertSqlIdentifier(table);
    if (!Array.isArray(rows)) throw new Error(`Invalid rows for table ${table}.`);
  }
  return parsed as FlowMangaBackup;
}

export async function restoreFlowMangaBackup(raw: string): Promise<void> {
  const backup = parseFlowMangaBackup(raw);
  const database = getDb();
  await database.execute('PRAGMA foreign_keys = OFF');
  await database.execute('BEGIN IMMEDIATE');
  try {
    const existingRows = await database.select<Array<{ name: string }>>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
    );
    const existing = new Set(existingRows.map(row => row.name));
    for (const [table, rows] of Object.entries(backup.tables)) {
      const safeTable = assertSqlIdentifier(table);
      if (!existing.has(safeTable)) continue;
      await database.execute(`DELETE FROM "${safeTable}"`);
      for (const row of rows) {
        const columns = Object.keys(row).map(assertSqlIdentifier);
        if (columns.length === 0) continue;
        const placeholders = columns.map(() => '?').join(', ');
        await database.execute(
          `INSERT INTO "${safeTable}" (${columns.map(column => `"${column}"`).join(', ')}) VALUES (${placeholders})`,
          columns.map(column => row[column] as string | number | null),
        );
      }
    }
    await database.execute('COMMIT');
  } catch (error) {
    await database.execute('ROLLBACK');
    diagnostics.log('error', 'backup', 'Backup restore failed', { details: { error: String(error) } });
    throw error;
  } finally {
    await database.execute('PRAGMA foreign_keys = ON');
  }

  if (backup.settings) {
    globalThis.localStorage?.setItem('flowmanga-settings', JSON.stringify(backup.settings));
  }
  diagnostics.log('info', 'backup', `Restored backup from ${backup.createdAt}`);
}
