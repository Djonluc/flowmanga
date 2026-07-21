import { describe, expect, it } from 'vitest';
import { fingerprintDistance } from './LibraryMaintenanceService';

describe('LibraryMaintenanceService', () => {
  it('calculates perceptual hash distance', () => {
    expect(fingerprintDistance('0000000000000000', '0000000000000000')).toBe(0);
    expect(fingerprintDistance('0000000000000000', '000000000000000f')).toBe(4);
    expect(fingerprintDistance('invalid', 'hash')).toBe(Number.MAX_SAFE_INTEGER);
  });
});
