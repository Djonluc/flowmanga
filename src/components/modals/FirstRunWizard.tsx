import { useRef, useState } from 'react';
import { BookOpen, Check, ChevronLeft, ChevronRight, FolderOpen, Shield, Sparkles } from 'lucide-react';
import { mkdir } from '@tauri-apps/plugin-fs';
import { open } from '@tauri-apps/plugin-dialog';
import { join } from '@tauri-apps/api/path';
import { federator } from '../../image-platform/SearchFederator';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useModalAccessibility } from '../../hooks/useModalAccessibility';

export const FirstRunWizard = () => {
  const settings = useSettingsStore();
  const [step, setStep] = useState(0);
  const [path, setPath] = useState(settings.downloadPath || '');
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalAccessibility(true, dialogRef, () => undefined);

  const chooseRecommended = async () => {
    setBusy(true);
    try {
      const nextPath = await settings.getRecommendedPath();
      await mkdir(nextPath, { recursive: true });
      settings.setDownloadPath(nextPath);
      settings.setLibraryPath(nextPath);
      setPath(nextPath);
      setStep(1);
    } finally { setBusy(false); }
  };

  const chooseCustom = async () => {
    const selected = await open({ directory: true, multiple: false, title: 'Choose FlowManga library folder' });
    if (!selected || typeof selected !== 'string') return;
    const nextPath = await join(selected, 'FlowManga');
    await mkdir(nextPath, { recursive: true });
    settings.setDownloadPath(nextPath);
    settings.setLibraryPath(nextPath);
    setPath(nextPath);
    setStep(1);
  };

  const finish = () => settings.setFirstRunComplete(true);
  const providers = federator.getProviders();

  return (
    <div className="fixed inset-0 z-[250] grid place-items-center bg-black/80 p-4 backdrop-blur-xl">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="setup-title" tabIndex={-1} className="w-full max-w-3xl overflow-hidden rounded-[32px] border border-border-strong bg-surface shadow-cinematic">
        <div className="border-b border-border-subtle p-6 sm:p-8"><p className="text-xs font-black uppercase tracking-[0.3em] text-accent">First-run setup · {step + 1} of 3</p><h2 id="setup-title" className="mt-2 text-3xl font-black text-foreground">Welcome to FlowManga</h2><div className="mt-5 grid grid-cols-3 gap-2">{[0, 1, 2].map(index => <div key={index} className={`h-1 rounded-full ${index <= step ? 'bg-accent' : 'bg-surface-raised'}`} />)}</div></div>
        <div className="min-h-[360px] p-6 sm:p-8">
          {step === 0 && <div className="space-y-5"><div className="flex items-start gap-3"><FolderOpen className="text-accent" /><div><h3 className="text-xl font-black text-foreground">Choose library storage</h3><p className="mt-1 text-sm text-foreground-dim">Downloaded manga, galleries, and metadata will be organized here.</p></div></div>{path && <p className="break-all rounded-xl bg-surface-raised p-3 text-xs text-foreground-dim">{path}</p>}<div className="grid gap-3 sm:grid-cols-2"><button disabled={busy} onClick={chooseRecommended} className="rounded-2xl bg-accent p-5 text-left font-bold text-white"><Sparkles className="mb-3" />Use recommended folder</button><button disabled={busy} onClick={chooseCustom} className="rounded-2xl border border-border-strong bg-surface-elevated p-5 text-left font-bold text-foreground"><FolderOpen className="mb-3" />Choose another folder</button></div></div>}
          {step === 1 && <div className="space-y-5"><div className="flex items-start gap-3"><Shield className="text-accent" /><div><h3 className="text-xl font-black text-foreground">Content safety</h3><p className="mt-1 text-sm text-foreground-dim">Explicit and questionable media stays hidden unless you deliberately enable it.</p></div></div><button type="button" role="switch" aria-checked={settings.showAdultContent} onClick={() => settings.setShowAdultContent(!settings.showAdultContent)} className="flex w-full items-center justify-between rounded-2xl border border-border-subtle bg-surface-elevated p-5 text-left"><span><strong className="text-foreground">Adult content</strong><span className="mt-1 block text-sm text-foreground-dim">Can be changed later in Settings.</span></span><span className={`rounded-full px-3 py-1 text-xs font-black ${settings.showAdultContent ? 'bg-rose-500 text-white' : 'bg-emerald-500/15 text-emerald-500'}`}>{settings.showAdultContent ? 'Enabled' : 'Hidden'}</span></button></div>}
          {step === 2 && <div className="space-y-5"><div className="flex items-start gap-3"><BookOpen className="text-accent" /><div><h3 className="text-xl font-black text-foreground">Choose discovery sources</h3><p className="mt-1 text-sm text-foreground-dim">Disable any source you do not want FlowManga to contact.</p></div></div><div className="grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2">{providers.map(provider => { const enabled = settings.isSourceEnabled(provider.id); return <button type="button" key={provider.id} aria-pressed={enabled} onClick={() => settings.toggleSource(provider.id)} className="flex items-center justify-between rounded-xl bg-surface-elevated p-3 text-sm font-bold text-foreground"><span>{provider.name}</span><span className={`grid h-6 w-6 place-items-center rounded-full ${enabled ? 'bg-accent text-white' : 'bg-surface-raised text-transparent'}`}><Check size={14} /></span></button>; })}</div></div>}
        </div>
        <div className="flex items-center justify-between border-t border-border-subtle p-5"><button type="button" disabled={step === 0} onClick={() => setStep(current => current - 1)} className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-foreground disabled:opacity-30"><ChevronLeft size={16} /> Back</button>{step === 1 && <button type="button" onClick={() => setStep(2)} className="flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-bold text-white">Sources <ChevronRight size={16} /></button>}{step === 2 && <button type="button" onClick={finish} className="flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-bold text-white">Finish setup <Check size={16} /></button>}</div>
      </div>
    </div>
  );
};
