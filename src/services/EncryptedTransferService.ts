const encoder = new TextEncoder();
const decoder = new TextDecoder();

interface EncryptedEnvelope {
  format: 'flowmanga-encrypted-transfer';
  version: 1;
  algorithm: 'AES-GCM';
  iterations: number;
  salt: string;
  iv: string;
  payload: string;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number, usage: KeyUsage[]): Promise<CryptoKey> {
  if (passphrase.length < 10) throw new Error('Use a passphrase of at least 10 characters.');
  const material = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    usage,
  );
}

export async function encryptFlowMangaTransfer(plainText: string, passphrase: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const iterations = 250_000;
  const key = await deriveKey(passphrase, salt, iterations, ['encrypt']);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(plainText));
  const envelope: EncryptedEnvelope = {
    format: 'flowmanga-encrypted-transfer', version: 1, algorithm: 'AES-GCM', iterations,
    salt: toBase64(salt), iv: toBase64(iv), payload: toBase64(new Uint8Array(encrypted)),
  };
  return JSON.stringify(envelope);
}

export async function decryptFlowMangaTransfer(raw: string, passphrase: string): Promise<string> {
  const envelope = JSON.parse(raw) as Partial<EncryptedEnvelope>;
  if (envelope.format !== 'flowmanga-encrypted-transfer' || envelope.version !== 1 || envelope.algorithm !== 'AES-GCM'
    || !envelope.salt || !envelope.iv || !envelope.payload || !envelope.iterations) {
    throw new Error('This is not a supported encrypted FlowManga transfer.');
  }
  const salt = fromBase64(envelope.salt);
  const iv = fromBase64(envelope.iv);
  const key = await deriveKey(passphrase, salt, envelope.iterations, ['decrypt']);
  try {
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, fromBase64(envelope.payload));
    return decoder.decode(decrypted);
  } catch {
    throw new Error('The passphrase is incorrect or the transfer file is damaged.');
  }
}
