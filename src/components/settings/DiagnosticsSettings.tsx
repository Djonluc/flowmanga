import { useSyncExternalStore } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Download, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { diagnostics, type ProviderDiagnostic } from '../../services/DiagnosticsService';
import { toast } from '../Toast';

const formatTime = (value?: number) => value ? new Date(value).toLocaleString() : 'Never';

const statusStyle: Record<ProviderDiagnostic['status'], string> = {
  authenticated: 'text-emerald-500 bg-emerald-500/10',
  public: 'text-blue-500 bg-blue-500/10',
  rate_limited: 'text-amber-500 bg-amber-500/10',
  expired: 'text-orange-500 bg-orange-500/10',
  degraded: 'text-amber-500 bg-amber-500/10',
  unavailable: 'text-rose-500 bg-rose-500/10',
  unknown: 'text-foreground-dim bg-surface-raised',
};

export const DiagnosticsSettings = () => {
  useSyncExternalStore(diagnostics.subscribe, diagnostics.getVersion, diagnostics.getVersion);
  const providers = diagnostics.getProviders();
  const events = diagnostics.getEvents();
  const troubleshooting = diagnostics.isTroubleshootingEnabled();

  const exportDiagnostics = async () => {
    try {
      const [{ save }, { writeTextFile }] = await Promise.all([
        import('@tauri-apps/plugin-dialog'),
        import('@tauri-apps/plugin-fs'),
      ]);
      const path = await save({
        defaultPath: `flowmanga-diagnostics-${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (!path) return;
      await writeTextFile(path, diagnostics.exportSnapshot());
      toast.success('Sanitized diagnostics exported');
    } catch (error) {
      diagnostics.log('error', 'diagnostics', 'Diagnostics export failed', { details: { error: String(error) } });
      toast.error('Could not export diagnostics');
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border-subtle bg-surface-elevated p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-foreground font-black uppercase tracking-widest text-sm">
              <ShieldCheck size={18} className="text-accent" /> Source Status
            </div>
            <p className="mt-2 text-sm text-foreground-dim">Provider health, authentication verification, pagination and redacted failures.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => diagnostics.setTroubleshootingEnabled(!troubleshooting)}
              aria-pressed={troubleshooting}
              className={clsx('rounded-xl px-3 py-2 text-xs font-bold transition-colors', troubleshooting ? 'bg-amber-500 text-black' : 'bg-surface-raised text-foreground')}
            >
              Troubleshooting {troubleshooting ? 'On' : 'Off'}
            </button>
            <button type="button" onClick={exportDiagnostics} className="rounded-xl bg-accent px-3 py-2 text-xs font-bold text-white flex items-center gap-2">
              <Download size={14} /> Export
            </button>
            <button type="button" onClick={() => diagnostics.clear()} aria-label="Clear diagnostics" className="rounded-xl bg-surface-raised p-2 text-foreground-dim hover:text-foreground">
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        {providers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border-subtle p-6 text-center text-sm text-foreground-dim">
            Provider activity will appear after the next Latest, Search, Discover, or For You request.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {providers.map(provider => (
              <article key={provider.providerId} className="rounded-2xl border border-border-subtle bg-surface p-4 min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <strong className="truncate capitalize text-foreground">{provider.providerId}</strong>
                  <span className={clsx('rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wider', statusStyle[provider.status])}>
                    {provider.status.replace('_', ' ')}
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div><dt className="text-foreground-muted">Last success</dt><dd className="text-foreground">{formatTime(provider.lastSuccessAt)}</dd></div>
                  <div><dt className="text-foreground-muted">Auth checked</dt><dd className="text-foreground">{formatTime(provider.authVerifiedAt)}</dd></div>
                  <div><dt className="text-foreground-muted">Page</dt><dd className="text-foreground">{provider.page ?? '—'}</dd></div>
                  <div><dt className="text-foreground-muted">Response</dt><dd className="text-foreground">{provider.responseTimeMs !== undefined ? `${provider.responseTimeMs} ms` : '—'}</dd></div>
                </dl>
                {provider.lastError && <p className="mt-3 break-words rounded-xl bg-rose-500/10 p-2 text-xs text-rose-500">{provider.lastError}</p>}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-border-subtle bg-surface-elevated p-5">
        <div className="flex items-center justify-between gap-3">
          <h4 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-foreground"><Activity size={16} /> Recent Events</h4>
          <span className="text-xs text-foreground-muted">{events.length} / 500</span>
        </div>
        <div className="mt-4 max-h-72 space-y-2 overflow-y-auto custom-scrollbar" aria-live="polite">
          {events.length === 0 && <p className="text-sm text-foreground-dim">No diagnostic events recorded.</p>}
          {[...events].reverse().slice(0, 100).map(event => (
            <div key={event.id} className="flex items-start gap-3 rounded-xl bg-surface p-3 text-xs">
              {event.level === 'error' || event.level === 'warning'
                ? <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" />
                : event.level === 'info'
                  ? <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-500" />
                  : <RefreshCw size={14} className="mt-0.5 shrink-0 text-blue-500" />}
              <div className="min-w-0"><p className="break-words text-foreground">{event.message}</p><p className="mt-1 text-foreground-muted">{event.providerId || event.area} · {formatTime(event.timestamp)}</p></div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
