import { invoke } from '@tauri-apps/api/core';
import { getDb } from '../services/db';
import type { PlatformImage } from './types';

interface FingerprintRow {
  imageId: string;
  fingerprint: string;
}

function hammingDistance(left: string, right: string): number {
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

async function mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(runners);
  return results;
}

export class MediaFingerprintService {
  static async filterRecentDuplicates(images: PlatformImage[]): Promise<PlatformImage[]> {
    if (images.length < 2) return images;
    const db = getDb();
    const recent = await db.select<FingerprintRow[]>(`
      SELECT imageId, fingerprint FROM FlowMediaFingerprints
      WHERE seenAt >= datetime('now', '-48 hours')
    `);
    const recentHashes = [...recent];

    const evaluated = await mapWithConcurrency(images, 4, async image => {
      const cached = await db.select<FingerprintRow[]>(
        'SELECT imageId, fingerprint FROM FlowMediaFingerprints WHERE imageId = ?',
        [image.id],
      );
      let fingerprint = cached[0]?.fingerprint;
      if (!fingerprint) {
        const url = image.thumbnailUrl || image.sampleUrl || image.fullUrl;
        try {
          fingerprint = await invoke<string>('compute_image_dhash', { url });
          await db.execute(`
            INSERT INTO FlowMediaFingerprints (imageId, providerId, fingerprint, computedAt)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(imageId) DO UPDATE SET fingerprint = excluded.fingerprint, computedAt = CURRENT_TIMESTAMP
          `, [image.id, image.providerId, fingerprint]);
        } catch (error) {
          console.debug(`[MediaFingerprint] Could not fingerprint ${image.id}:`, error);
        }
      }
      return { image, fingerprint };
    });

    const unique: PlatformImage[] = [];
    for (const { image, fingerprint } of evaluated) {
      const duplicate = fingerprint && recentHashes.some(row => row.imageId !== image.id && hammingDistance(row.fingerprint, fingerprint!) <= 5);
      if (duplicate) continue;
      unique.push(image);
      if (fingerprint) {
        recentHashes.push({ imageId: image.id, fingerprint });
        await db.execute('UPDATE FlowMediaFingerprints SET seenAt = CURRENT_TIMESTAMP WHERE imageId = ?', [image.id]);
      }
    }
    if (unique.length !== images.length) {
      console.info(`[MediaFingerprint] suppressed ${images.length - unique.length}/${images.length} visually repeated items`);
    }
    return unique;
  }
}
