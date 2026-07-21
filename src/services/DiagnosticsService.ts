export type DiagnosticLevel = 'error' | 'warning' | 'info' | 'debug' | 'trace';
export type ProviderRuntimeStatus = 'unknown' | 'public' | 'authenticated' | 'expired' | 'rate_limited' | 'degraded' | 'unavailable';

export interface DiagnosticEvent {
  id: string;
  timestamp: number;
  level: DiagnosticLevel;
  area: string;
  message: string;
  providerId?: string;
  details?: Record<string, unknown>;
}

export interface ProviderDiagnostic {
  providerId: string;
  status: ProviderRuntimeStatus;
  lastAttemptAt?: number;
  lastSuccessAt?: number;
  lastErrorAt?: number;
  lastError?: string;
  authVerifiedAt?: number;
  page?: number;
  cursor?: string;
  retryAt?: number;
  responseTimeMs?: number;
}

const SECRET_PATTERN = /(cookie|authorization|api[-_ ]?key|access[-_ ]?token|refresh[-_ ]?token|password|session|secret)/i;
const MAX_EVENTS = 500;
const listeners = new Set<() => void>();
const events: DiagnosticEvent[] = [];
const providers = new Map<string, ProviderDiagnostic>();
let version = 0;
let consoleCaptureInstalled = false;

function notify(): void {
  version += 1;
  listeners.forEach(listener => listener());
}

export function redactDiagnosticText(value: unknown): string {
  return String(value ?? '')
    .replace(/([?&](?:api_key|access_token|refresh_token|token|password|user_id)=)[^&\s)]+/gi, '$1***')
    .replace(/\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+\/-]+=*/gi, 'Bearer ***')
    .replace(/(?:cookie|authorization)\s*[:=]\s*[^,;\n]+/gi, match => `${match.split(/[:=]/)[0]}: ***`)
    .replace(/[A-Z]:\\Users\\[^\\\s]+/gi, '%USERPROFILE%')
    .replace(/\\Users\\[^\\\s]+/gi, '\\Users\\***');
}

function sanitizeDetails(value: unknown, key = ''): unknown {
  if (SECRET_PATTERN.test(key)) return '[REDACTED]';
  if (typeof value === 'string') return redactDiagnosticText(value);
  if (Array.isArray(value)) return value.map(item => sanitizeDetails(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .map(([entryKey, entryValue]) => [entryKey, sanitizeDetails(entryValue, entryKey)]));
  }
  return value;
}

function troubleshootingEnabled(): boolean {
  try {
    return globalThis.localStorage?.getItem('flowmanga-troubleshooting') === 'true';
  } catch {
    return false;
  }
}

export const diagnostics = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  getVersion(): number {
    return version;
  },

  getEvents(): readonly DiagnosticEvent[] {
    return events;
  },

  getProviders(): ProviderDiagnostic[] {
    return Array.from(providers.values()).sort((a, b) => a.providerId.localeCompare(b.providerId));
  },

  setTroubleshootingEnabled(enabled: boolean): void {
    try {
      globalThis.localStorage?.setItem('flowmanga-troubleshooting', String(enabled));
    } catch {
      // Diagnostics must never break application behavior when storage is unavailable.
    }
    notify();
  },

  isTroubleshootingEnabled(): boolean {
    return troubleshootingEnabled();
  },

  log(level: DiagnosticLevel, area: string, message: string, context: { providerId?: string; details?: Record<string, unknown> } = {}): void {
    if ((level === 'debug' || level === 'trace') && !troubleshootingEnabled()) return;
    events.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      level,
      area,
      message: redactDiagnosticText(message),
      providerId: context.providerId,
      details: context.details ? sanitizeDetails(context.details) as Record<string, unknown> : undefined,
    });
    if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
    notify();
  },

  providerAttempt(providerId: string, context: { page?: number; cursor?: string } = {}): void {
    const current = providers.get(providerId) ?? { providerId, status: 'unknown' as const };
    providers.set(providerId, { ...current, ...context, cursor: context.cursor ? redactDiagnosticText(context.cursor) : current.cursor, lastAttemptAt: Date.now() });
    notify();
  },

  providerSuccess(providerId: string, responseTimeMs?: number, authenticated?: boolean): void {
    const current = providers.get(providerId) ?? { providerId, status: 'unknown' as const };
    providers.set(providerId, {
      ...current,
      status: authenticated ? 'authenticated' : current.status === 'authenticated' ? 'authenticated' : 'public',
      lastSuccessAt: Date.now(),
      responseTimeMs,
      lastError: undefined,
      retryAt: undefined,
    });
    notify();
  },

  providerFailure(providerId: string, error: unknown, retryAt?: number): void {
    const message = redactDiagnosticText(error instanceof Error ? error.message : error);
    const status: ProviderRuntimeStatus = retryAt || /429|rate.?limit/i.test(message)
      ? 'rate_limited'
      : /401|403|unauthorized|forbidden|expired/i.test(message)
        ? 'expired'
        : 'degraded';
    const current = providers.get(providerId) ?? { providerId, status: 'unknown' as const };
    providers.set(providerId, { ...current, status, lastErrorAt: Date.now(), lastError: message, retryAt });
    this.log('warning', 'provider', message, { providerId });
    notify();
  },

  providerAuth(providerId: string, authenticated: boolean, error?: unknown): void {
    const current = providers.get(providerId) ?? { providerId, status: 'unknown' as const };
    providers.set(providerId, {
      ...current,
      status: authenticated ? 'authenticated' : error ? 'expired' : 'public',
      authVerifiedAt: Date.now(),
      lastError: error ? redactDiagnosticText(error) : current.lastError,
    });
    notify();
  },

  clear(): void {
    events.length = 0;
    providers.clear();
    notify();
  },

  exportSnapshot(): string {
    return JSON.stringify({
      generatedAt: new Date().toISOString(),
      appVersion: '2.5.3',
      userAgent: redactDiagnosticText(globalThis.navigator?.userAgent ?? 'unknown'),
      providers: this.getProviders(),
      events,
    }, null, 2);
  },
};

export function installConsoleDiagnostics(): void {
  if (consoleCaptureInstalled) return;
  consoleCaptureInstalled = true;
  const methods: Array<[keyof Pick<Console, 'error' | 'warn' | 'info' | 'debug' | 'trace'>, DiagnosticLevel]> = [
    ['error', 'error'], ['warn', 'warning'], ['info', 'info'], ['debug', 'debug'], ['trace', 'trace'],
  ];
  for (const [method, level] of methods) {
    const original = console[method].bind(console);
    console[method] = (...args: unknown[]) => {
      original(...args);
      const message = args.map(argument => {
        if (argument instanceof Error) return argument.message;
        if (typeof argument === 'string') return argument;
        try { return JSON.stringify(sanitizeDetails(argument)); } catch { return String(argument); }
      }).join(' ');
      const providerMatch = message.match(/^\[(?:BaseProvider\]\[)?([^\]]+)\]/);
      diagnostics.log(level, providerMatch ? 'provider' : 'application', message, { providerId: providerMatch?.[1] });
    };
  }
}
