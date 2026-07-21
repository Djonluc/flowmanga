import { useState } from 'react';
import { ArchiveRestore, Download, LockKeyhole, ShieldCheck, Upload } from 'lucide-react';
import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { createFlowMangaBackup, restoreFlowMangaBackup } from '../../services/DataPortabilityService';
import { toast } from '../Toast';
import { LibraryMaintenanceSettings } from './LibraryMaintenanceSettings';
import { decryptFlowMangaTransfer, encryptFlowMangaTransfer } from '../../services/EncryptedTransferService';

export const DataManagementSettings = () => {
  const [busy, setBusy] = useState(false);
  const [transferPassphrase, setTransferPassphrase] = useState('');

  const exportBackup = async () => {
    setBusy(true);
    try {
      const path = await save({ defaultPath: `flowmanga-backup-${new Date().toISOString().slice(0, 10)}.json`, filters: [{ name: 'FlowManga backup', extensions: ['json'] }] });
      if (!path) return;
      await writeTextFile(path, await createFlowMangaBackup());
      toast.success('Library and settings backup created');
    } catch (error) {
      toast.error(`Backup failed: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const exportEncrypted = async () => {
    setBusy(true);
    try {
      const path = await save({ defaultPath: `flowmanga-encrypted-${new Date().toISOString().slice(0, 10)}.flowmanga`, filters: [{ name: 'Encrypted FlowManga transfer', extensions: ['flowmanga'] }] });
      if (!path) return;
      await writeTextFile(path, await encryptFlowMangaTransfer(await createFlowMangaBackup(), transferPassphrase));
      toast.success('Encrypted device-transfer file created');
    } catch (error) { toast.error(String(error)); } finally { setBusy(false); }
  };

  const importEncrypted = async () => {
    const path = await open({ multiple: false, directory: false, filters: [{ name: 'Encrypted FlowManga transfer', extensions: ['flowmanga'] }] });
    if (!path || typeof path !== 'string') return;
    setBusy(true);
    try {
      const backup = await decryptFlowMangaTransfer(await readTextFile(path), transferPassphrase);
      await restoreFlowMangaBackup(backup);
      toast.success('Encrypted transfer restored. FlowManga will reload now.');
      globalThis.setTimeout(() => globalThis.location.reload(), 700);
    } catch (error) { toast.error(String(error)); } finally { setBusy(false); }
  };

  const restoreBackup = async () => {
    const path = await open({ multiple: false, directory: false, filters: [{ name: 'FlowManga backup', extensions: ['json'] }] });
    if (!path || typeof path !== 'string') return;
    if (!globalThis.confirm('Restore this backup? Current library database records will be replaced. Downloaded files will not be deleted.')) return;
    setBusy(true);
    try {
      await restoreFlowMangaBackup(await readTextFile(path));
      toast.success('Backup restored. FlowManga will reload now.');
      globalThis.setTimeout(() => globalThis.location.reload(), 700);
    } catch (error) {
      toast.error(`Restore failed: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border-subtle bg-surface-elevated p-6">
        <div className="flex items-start gap-3"><ArchiveRestore className="text-accent" /><div><h4 className="font-black uppercase tracking-widest text-foreground">Backup and Restore</h4><p className="mt-2 text-sm text-foreground-dim">Export the entire library database and non-secret application settings to one portable file.</p></div></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button type="button" disabled={busy} onClick={exportBackup} className="rounded-2xl bg-accent px-4 py-4 font-bold text-white disabled:opacity-50 flex items-center justify-center gap-2"><Download size={18} /> Export backup</button>
          <button type="button" disabled={busy} onClick={restoreBackup} className="rounded-2xl border border-border-strong bg-surface px-4 py-4 font-bold text-foreground disabled:opacity-50 flex items-center justify-center gap-2"><Upload size={18} /> Restore backup</button>
        </div>
        <div className="mt-4 flex items-start gap-2 rounded-2xl bg-emerald-500/10 p-4 text-sm text-emerald-600"><ShieldCheck size={18} className="shrink-0" /><p>Passwords, cookies, API keys, and provider sessions are deliberately excluded. Downloaded media remains in its existing folders.</p></div>
      </section>
      <section className="rounded-3xl border border-border-subtle bg-surface-elevated p-6 space-y-4">
        <div className="flex items-start gap-3"><LockKeyhole className="text-accent" /><div><h4 className="font-black uppercase tracking-widest text-foreground">Encrypted Device Transfer</h4><p className="mt-2 text-sm text-foreground-dim">Move your library database and settings between devices using an AES-256-GCM encrypted file. FlowManga never stores the passphrase.</p></div></div>
        <label className="block text-xs font-bold text-foreground-dim">Transfer passphrase<input type="password" autoComplete="new-password" value={transferPassphrase} onChange={event => setTransferPassphrase(event.target.value)} placeholder="At least 10 characters" className="mt-2 w-full rounded-xl border border-border-subtle bg-surface px-4 py-3 text-foreground" /></label>
        <div className="grid gap-3 sm:grid-cols-2"><button type="button" disabled={busy || transferPassphrase.length < 10} onClick={exportEncrypted} className="rounded-xl bg-accent px-4 py-3 font-bold text-white disabled:opacity-40">Export encrypted transfer</button><button type="button" disabled={busy || transferPassphrase.length < 10} onClick={importEncrypted} className="rounded-xl border border-border-strong bg-surface px-4 py-3 font-bold text-foreground disabled:opacity-40">Import encrypted transfer</button></div>
      </section>
      <LibraryMaintenanceSettings />
    </div>
  );
};
