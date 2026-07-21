import { exists, stat } from '@tauri-apps/plugin-fs';
import { invoke } from '@tauri-apps/api/core';
import { getDb } from './db';
import { diagnostics } from './DiagnosticsService';

export interface IntegrityIssue {
  id: string;
  kind: 'chapter' | 'saved_image';
  title: string;
  path: string;
  status: 'missing' | 'empty' | 'ok';
  sourceId?: string;
}

export interface DuplicateItem {
  id: string;
  title: string;
  providerId: string;
  previewUrl: string;
  localPath?: string;
  fingerprint: string;
}

export interface DuplicateGroup {
  fingerprint: string;
  items: DuplicateItem[];
}

interface LocalRecord {
  id: string;
  kind: IntegrityIssue['kind'];
  title: string;
  path: string;
  sourceId?: string;
}

export function fingerprintDistance(left: string, right: string): number {
  try {
    let bits = BigInt(`0x${left}`) ^ BigInt(`0x${right}`);
    let count = 0;
    while (bits > 0n) {
      bits &= bits - 1n;
      count += 1;
    }
    return count;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

async function concurrentMap<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
    }
  }));
  return results;
}

export async function scanLibraryIntegrity(): Promise<IntegrityIssue[]> {
  const database = getDb();
  const chapters = await database.select<Array<{ id: string; title: string; filePath: string; sourceId?: string }>>(
    'SELECT id, title, filePath, sourceId FROM Chapters WHERE filePath IS NOT NULL AND filePath != ?', [''],
  );
  const images = await database.select<Array<{ id: string; localPath: string; sourceId?: string }>>(
    'SELECT id, localPath, sourceId FROM FlowSavedImages WHERE isLocal = 1 AND localPath IS NOT NULL AND localPath != ?', [''],
  );
  const records: LocalRecord[] = [
    ...chapters.map(row => ({ id: row.id, kind: 'chapter' as const, title: row.title, path: row.filePath, sourceId: row.sourceId })),
    ...images.map(row => ({ id: row.id, kind: 'saved_image' as const, title: row.id, path: row.localPath, sourceId: row.sourceId })),
  ];

  const scanned = await concurrentMap(records, 8, async record => {
    let status: IntegrityIssue['status'] = 'missing';
    let actualSize: number | null = null;
    try {
      if (await exists(record.path)) {
        const metadata = await stat(record.path);
        actualSize = metadata.size;
        status = metadata.isFile && metadata.size === 0 ? 'empty' : 'ok';
      }
    } catch {
      status = 'missing';
    }
    await database.execute(`
      INSERT INTO DownloadIntegrity (id, localPath, actualSize, status, checkedAt)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET localPath = excluded.localPath, actualSize = excluded.actualSize,
        status = excluded.status, checkedAt = CURRENT_TIMESTAMP
    `, [`${record.kind}:${record.id}`, record.path, actualSize, status]);
    return { ...record, status } satisfies IntegrityIssue;
  });
  const issues = scanned.filter(item => item.status !== 'ok');
  diagnostics.log(issues.length ? 'warning' : 'info', 'integrity', `Integrity scan completed: ${issues.length} issue(s) across ${records.length} local records`);
  return issues;
}

export async function detachMissingRecord(issue: IntegrityIssue): Promise<void> {
  const database = getDb();
  if (issue.kind === 'saved_image') {
    await database.execute('UPDATE FlowSavedImages SET isLocal = 0, localPath = NULL WHERE id = ?', [issue.id]);
  } else {
    await database.execute('DELETE FROM ReadingProgress WHERE chapterId = ?', [issue.id]);
    await database.execute('DELETE FROM Chapters WHERE id = ?', [issue.id]);
  }
  await database.execute('DELETE FROM DownloadIntegrity WHERE id = ?', [`${issue.kind}:${issue.id}`]);
  diagnostics.log('info', 'integrity', `Detached missing ${issue.kind} record ${issue.id}`);
}

export async function findSavedImageDuplicates(maxDistance = 5): Promise<DuplicateGroup[]> {
  const database = getDb();
  const images = await database.select<Array<{ id: string; providerId: string; localPath?: string; thumbnailUrl?: string; sampleUrl?: string; fullUrl: string }>>(
    'SELECT id, providerId, localPath, thumbnailUrl, sampleUrl, fullUrl FROM FlowSavedImages',
  );
  const evaluated = await concurrentMap(images, 3, async image => {
    const cached = await database.select<Array<{ fingerprint: string }>>('SELECT fingerprint FROM FlowMediaFingerprints WHERE imageId = ?', [image.id]);
    let fingerprint = cached[0]?.fingerprint;
    if (!fingerprint) {
      const target = image.localPath || image.thumbnailUrl || image.sampleUrl || image.fullUrl;
      try {
        fingerprint = await invoke<string>('compute_image_dhash', { url: target });
        await database.execute(`INSERT INTO FlowMediaFingerprints (imageId, providerId, fingerprint, computedAt)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(imageId) DO UPDATE SET fingerprint = excluded.fingerprint, computedAt = CURRENT_TIMESTAMP`,
        [image.id, image.providerId, fingerprint]);
      } catch (error) {
        diagnostics.log('debug', 'duplicates', `Could not fingerprint ${image.id}`, { details: { error: String(error) } });
      }
    }
    return fingerprint ? {
      id: image.id,
      title: image.id,
      providerId: image.providerId,
      previewUrl: image.thumbnailUrl || image.sampleUrl || image.fullUrl,
      localPath: image.localPath,
      fingerprint,
    } satisfies DuplicateItem : null;
  });
  const remaining = evaluated.filter((item): item is DuplicateItem => item !== null);
  const groups: DuplicateGroup[] = [];
  while (remaining.length > 0) {
    const first = remaining.shift()!;
    const matches = [first];
    for (let index = remaining.length - 1; index >= 0; index -= 1) {
      if (fingerprintDistance(first.fingerprint, remaining[index].fingerprint) <= maxDistance) {
        matches.push(remaining.splice(index, 1)[0]);
      }
    }
    if (matches.length > 1) groups.push({ fingerprint: first.fingerprint, items: matches });
  }
  diagnostics.log('info', 'duplicates', `Duplicate scan found ${groups.length} group(s)`);
  return groups;
}

export async function removeSavedImageDuplicate(id: string): Promise<void> {
  const database = getDb();
  await database.execute('DELETE FROM FlowSavedImages WHERE id = ?', [id]);
  await database.execute('DELETE FROM FlowMediaFingerprints WHERE imageId = ?', [id]);
}
