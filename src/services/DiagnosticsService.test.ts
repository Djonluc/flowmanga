import { beforeEach, describe, expect, it } from 'vitest';
import { diagnostics, redactDiagnosticText } from './DiagnosticsService';

describe('DiagnosticsService', () => {
  beforeEach(() => diagnostics.clear());

  it('redacts credentials and local usernames', () => {
    const result = redactDiagnosticText('https://x.test?a=1&api_key=secret C:\\Users\\person\\file Cookie: abc');
    expect(result).not.toContain('secret');
    expect(result).not.toContain('person');
    expect(result).not.toContain('abc');
  });

  it('tracks provider success and rate limits', () => {
    diagnostics.providerAttempt('example', { page: 2 });
    diagnostics.providerSuccess('example', 42, true);
    expect(diagnostics.getProviders()[0]).toMatchObject({ providerId: 'example', page: 2, status: 'authenticated', responseTimeMs: 42 });

    diagnostics.providerFailure('example', new Error('HTTP 429'), Date.now() + 1000);
    expect(diagnostics.getProviders()[0].status).toBe('rate_limited');
  });

  it('redacts sensitive detail keys in exported events', () => {
    diagnostics.log('info', 'test', 'request complete', { details: { cookie: 'secret', count: 3 } });
    const snapshot = diagnostics.exportSnapshot();
    expect(snapshot).not.toContain('secret');
    expect(snapshot).toContain('[REDACTED]');
  });

  it('exports the package version instead of a stale hard-coded version', () => {
    expect(JSON.parse(diagnostics.exportSnapshot()).appVersion).toBe('2.5.6');
  });
});
