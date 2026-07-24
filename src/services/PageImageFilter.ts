export function isDownloadablePageImage(image: unknown): image is { url: string; pageNumber?: number; encryptionKey?: string } {
  if (!image || typeof image !== 'object') return false;
  const url = String((image as { url?: unknown }).url ?? '').trim();
  if (!/^https?:\/\//i.test(url)) return false;
  const lower = url.toLowerCase();
  if (/\.svg(?:[?#]|$)/i.test(lower)) return false;
  if (/(?:loading|spinner|placeholder|comments?|avatar|logo|icon|pixel|blank)[_./-]/i.test(lower)) return false;
  return /\.(?:jpe?g|png|webp|avif|gif)(?:[?#]|$)/i.test(lower)
    || /(?:image|page|chapter|uploads?)/i.test(lower);
}

export function filterDownloadablePageUrls(urls: string[]): string[] {
  return urls.filter(url => isDownloadablePageImage({ url }));
}
