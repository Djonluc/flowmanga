import { describe, expect, it } from 'vitest';
import { assertSqlIdentifier, parseFlowMangaBackup } from './DataPortabilityService';

describe('DataPortabilityService validation', () => {
  it('accepts database identifiers and rejects SQL injection', () => {
    expect(assertSqlIdentifier('FlowSavedImages')).toBe('FlowSavedImages');
    expect(() => assertSqlIdentifier('Series; DROP TABLE Series')).toThrow();
  });

  it('validates the backup envelope', () => {
    const raw = JSON.stringify({ format: 'flowmanga-backup', version: 1, createdAt: 'now', appVersion: 'x', settings: null, tables: { Series: [] } });
    expect(parseFlowMangaBackup(raw).tables.Series).toEqual([]);
    expect(() => parseFlowMangaBackup('{}')).toThrow();
  });
});
