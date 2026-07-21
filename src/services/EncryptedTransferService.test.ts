import { describe, expect, it } from 'vitest';
import { decryptFlowMangaTransfer, encryptFlowMangaTransfer } from './EncryptedTransferService';

describe('EncryptedTransferService', () => {
  it('round-trips encrypted application data', async () => {
    const encrypted = await encryptFlowMangaTransfer('{"library":true}', 'correct horse battery staple');
    expect(encrypted).not.toContain('library');
    expect(await decryptFlowMangaTransfer(encrypted, 'correct horse battery staple')).toBe('{"library":true}');
  }, 15_000);

  it('rejects an incorrect passphrase', async () => {
    const encrypted = await encryptFlowMangaTransfer('private', 'correct horse battery staple');
    await expect(decryptFlowMangaTransfer(encrypted, 'incorrect password')).rejects.toThrow('incorrect');
  }, 15_000);
});
