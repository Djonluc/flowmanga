import { describe, expect, it } from 'vitest';
import { bridgeSeries } from './bridge';
import type { SourceProvider, SourceSeries } from './types';

describe('source bridge resilience', () => {
  it('treats a malformed missing chapter list as empty', () => {
    const series = {
      title: 'Partial result',
      description: '',
      coverUrl: '',
      seriesUrl: 'https://example.test/series',
      source: 'example',
      chapters: undefined,
    } as unknown as SourceSeries;
    const provider = { id: 'example' } as SourceProvider;

    expect(bridgeSeries(series, provider).series?.chapters).toEqual([]);
  });
});
