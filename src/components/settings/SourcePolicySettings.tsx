import { Clock3, Gauge } from 'lucide-react';
import { federator } from '../../image-platform/SearchFederator';
import { useSettingsStore, type ProviderRuntimePolicy } from '../../stores/useSettingsStore';

const defaults: ProviderRuntimePolicy = {
  minRequestIntervalMs: 0,
  maxRetries: 3,
  scheduleEnabled: false,
  activeFromHour: 0,
  activeToHour: 24,
};

export const SourcePolicySettings = () => {
  const { providerPolicies, setProviderPolicy } = useSettingsStore();
  return (
    <section className="space-y-4">
      <div className="flex items-start gap-3"><Gauge className="text-accent" /><div><h4 className="font-black uppercase tracking-widest text-foreground">Source Scheduling & Rate Limits</h4><p className="mt-1 text-sm text-foreground-dim">Optional local safeguards. Provider-required minimum delays still take precedence.</p></div></div>
      <div className="space-y-3">
        {federator.getProviders().map(provider => {
          const policy = { ...defaults, ...providerPolicies[provider.id] };
          return (
            <article key={provider.id} className="rounded-2xl border border-border-subtle bg-surface-elevated p-4">
              <div className="flex items-center justify-between gap-3"><strong className="text-foreground">{provider.name}</strong><label className="flex items-center gap-2 text-xs font-bold text-foreground-dim"><Clock3 size={14} /> Scheduled <input type="checkbox" checked={policy.scheduleEnabled} onChange={event => setProviderPolicy(provider.id, { scheduleEnabled: event.target.checked })} /></label></div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="text-xs font-bold text-foreground-dim">Minimum delay
                  <select value={policy.minRequestIntervalMs} onChange={event => setProviderPolicy(provider.id, { minRequestIntervalMs: Number(event.target.value) })} className="mt-1 w-full rounded-xl border border-border-subtle bg-surface px-3 py-2 text-foreground">
                    <option value={0}>Provider default</option><option value={500}>0.5 seconds</option><option value={1000}>1 second</option><option value={3000}>3 seconds</option><option value={5000}>5 seconds</option>
                  </select>
                </label>
                <label className="text-xs font-bold text-foreground-dim">Maximum retries
                  <select value={policy.maxRetries} onChange={event => setProviderPolicy(provider.id, { maxRetries: Number(event.target.value) })} className="mt-1 w-full rounded-xl border border-border-subtle bg-surface px-3 py-2 text-foreground">
                    <option value={1}>1</option><option value={2}>2</option><option value={3}>3</option><option value={4}>4</option><option value={5}>5</option>
                  </select>
                </label>
              </div>
              {policy.scheduleEnabled && <div className="mt-4 grid grid-cols-2 gap-4">
                <label className="text-xs font-bold text-foreground-dim">Active from <input type="number" min={0} max={23} value={policy.activeFromHour} onChange={event => setProviderPolicy(provider.id, { activeFromHour: Number(event.target.value) })} className="mt-1 w-full rounded-xl border border-border-subtle bg-surface px-3 py-2 text-foreground" /></label>
                <label className="text-xs font-bold text-foreground-dim">Active until <input type="number" min={1} max={24} value={policy.activeToHour} onChange={event => setProviderPolicy(provider.id, { activeToHour: Number(event.target.value) })} className="mt-1 w-full rounded-xl border border-border-subtle bg-surface px-3 py-2 text-foreground" /></label>
              </div>}
            </article>
          );
        })}
      </div>
    </section>
  );
};
