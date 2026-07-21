import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Copy, FileSearch, Loader2, Trash2, Wrench } from 'lucide-react';
import {
  detachMissingRecord,
  findSavedImageDuplicates,
  removeSavedImageDuplicate,
  scanLibraryIntegrity,
  type DuplicateGroup,
  type IntegrityIssue,
} from '../../services/LibraryMaintenanceService';
import { toast } from '../Toast';

export const LibraryMaintenanceSettings = () => {
  const [integrityIssues, setIntegrityIssues] = useState<IntegrityIssue[] | null>(null);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[] | null>(null);
  const [scanningIntegrity, setScanningIntegrity] = useState(false);
  const [scanningDuplicates, setScanningDuplicates] = useState(false);

  const scanIntegrity = async () => {
    setScanningIntegrity(true);
    try {
      const issues = await scanLibraryIntegrity();
      setIntegrityIssues(issues);
      toast.success(issues.length ? `Found ${issues.length} integrity issue(s)` : 'All local library records are healthy');
    } catch (error) {
      toast.error(`Integrity scan failed: ${String(error)}`);
    } finally {
      setScanningIntegrity(false);
    }
  };

  const detachIssue = async (issue: IntegrityIssue) => {
    if (!globalThis.confirm(`Remove the stale library record for "${issue.title}"? No files will be deleted.`)) return;
    await detachMissingRecord(issue);
    setIntegrityIssues(current => current?.filter(item => item.id !== issue.id) ?? null);
    toast.success('Stale record removed');
  };

  const scanDuplicates = async () => {
    setScanningDuplicates(true);
    try {
      const groups = await findSavedImageDuplicates();
      setDuplicateGroups(groups);
      toast.success(groups.length ? `Found ${groups.length} duplicate group(s)` : 'No visual duplicates found');
    } catch (error) {
      toast.error(`Duplicate scan failed: ${String(error)}`);
    } finally {
      setScanningDuplicates(false);
    }
  };

  const removeDuplicate = async (groupFingerprint: string, id: string) => {
    if (!globalThis.confirm('Remove this duplicate from My Collection? Its downloaded file will be kept.')) return;
    await removeSavedImageDuplicate(id);
    setDuplicateGroups(current => current?.map(group => group.fingerprint === groupFingerprint
      ? { ...group, items: group.items.filter(item => item.id !== id) }
      : group).filter(group => group.items.length > 1) ?? null);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border-subtle bg-surface-elevated p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3"><Wrench className="text-accent" /><div><h4 className="font-black uppercase tracking-widest text-foreground">Download Integrity</h4><p className="mt-1 text-sm text-foreground-dim">Find missing or empty chapter and collection files without deleting anything.</p></div></div>
          <button type="button" disabled={scanningIntegrity} onClick={scanIntegrity} className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white disabled:opacity-50 flex items-center gap-2">
            {scanningIntegrity ? <Loader2 size={16} className="animate-spin" /> : <FileSearch size={16} />} Scan files
          </button>
        </div>
        {integrityIssues?.length === 0 && <div className="flex items-center gap-2 rounded-2xl bg-emerald-500/10 p-4 text-sm text-emerald-600"><CheckCircle2 size={18} /> No missing or empty local records.</div>}
        {integrityIssues && integrityIssues.length > 0 && <div className="space-y-2">{integrityIssues.map(issue => (
          <div key={`${issue.kind}:${issue.id}`} className="flex items-center justify-between gap-3 rounded-2xl bg-amber-500/10 p-3">
            <div className="min-w-0 flex items-start gap-2"><AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-500" /><div className="min-w-0"><p className="truncate text-sm font-bold text-foreground">{issue.title}</p><p className="truncate text-xs text-foreground-muted">{issue.status} · {issue.path}</p></div></div>
            <button type="button" onClick={() => detachIssue(issue)} className="shrink-0 rounded-lg bg-surface px-3 py-2 text-xs font-bold text-foreground">Remove stale record</button>
          </div>
        ))}</div>}
      </section>

      <section className="rounded-3xl border border-border-subtle bg-surface-elevated p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3"><Copy className="text-accent" /><div><h4 className="font-black uppercase tracking-widest text-foreground">Visual Duplicates</h4><p className="mt-1 text-sm text-foreground-dim">Compare perceptual hashes to find identical and near-identical saved images.</p></div></div>
          <button type="button" disabled={scanningDuplicates} onClick={scanDuplicates} className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white disabled:opacity-50 flex items-center gap-2">
            {scanningDuplicates ? <Loader2 size={16} className="animate-spin" /> : <Copy size={16} />} Scan collection
          </button>
        </div>
        {duplicateGroups?.length === 0 && <div className="flex items-center gap-2 rounded-2xl bg-emerald-500/10 p-4 text-sm text-emerald-600"><CheckCircle2 size={18} /> No visual duplicates found.</div>}
        {duplicateGroups && duplicateGroups.length > 0 && <div className="space-y-4">{duplicateGroups.map((group, groupIndex) => (
          <div key={group.fingerprint} className="rounded-2xl border border-border-subtle bg-surface p-4">
            <p className="mb-3 text-xs font-black uppercase tracking-widest text-foreground-muted">Duplicate group {groupIndex + 1} · keep at least one</p>
            <div className="grid gap-3 sm:grid-cols-2">{group.items.map((item, itemIndex) => (
              <div key={item.id} className="flex min-w-0 items-center gap-3 rounded-xl bg-surface-raised p-2">
                <img src={item.previewUrl} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-foreground">{item.title}</p><p className="text-[10px] uppercase text-foreground-muted">{item.providerId}{itemIndex === 0 ? ' · suggested keeper' : ''}</p></div>
                {itemIndex > 0 && <button type="button" aria-label={`Remove duplicate ${item.title}`} onClick={() => removeDuplicate(group.fingerprint, item.id)} className="rounded-lg p-2 text-rose-500 hover:bg-rose-500/10"><Trash2 size={16} /></button>}
              </div>
            ))}</div>
          </div>
        ))}</div>}
      </section>
    </div>
  );
};
