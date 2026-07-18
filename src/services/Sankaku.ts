import { useSettingsStore } from '../stores/useSettingsStore';

// Sankaku has changed API hostnames over time. Keep the current v2 host first,
// with the legacy alias as a compatibility fallback for older installations.
export const SANKAKU_API_BASES = [
  'https://capi-v2.sankakucomplex.com',
  'https://sankakuapi.com',
] as const;
export const SANKAKU_WEB_BASE = 'https://chan.sankakucomplex.com';
export const SANKAKU_LOGIN_URL = 'https://login.sankakucomplex.com/login';
export const SANKAKU_BOOKS_URL = 'https://www.sankakucomplex.com/books';

export interface SankakuTag {
  name?: string;
  name_en?: string;
  type?: number | string;
}

export interface SankakuPost {
  id?: number | string;
  parent_id?: number | string | null;
  pool_id?: number | string | null;
  pool_ids?: Array<number | string>;
  book_id?: number | string | null;
  book_ids?: Array<number | string>;
  sequence?: number | string | null;
  created_at?: string | number | { s?: number; n?: number };
  rating?: string;
  status?: string;
  file_url?: string;
  sample_url?: string;
  preview_url?: string;
  sample_width?: number;
  sample_height?: number;
  preview_width?: number;
  preview_height?: number;
  width?: number;
  height?: number;
  file_size?: number;
  file_type?: string;
  md5?: string;
  source?: string;
  author?: { id?: number | string; name?: string } | string;
  tags?: SankakuTag[];
  has_children?: boolean;
  is_premium?: boolean;
  redirect_to_signup?: boolean;
  video_duration?: number;
  total_score?: number;
  score?: number;
  fav_count?: number;
  recommended_posts?: Array<number | string>;
}

export interface SankakuTagBuckets {
  all: string[];
  artist: string[];
  character: string[];
  copyright: string[];
  general: string[];
  meta: string[];
}

export interface SankakuGroupInfo {
  relatedGroupId?: string;
  relatedIndex?: number;
  parentId?: string;
  poolIds: string[];
  bookIds: string[];
}

export function getSankakuAuthHeaders(): Record<string, string> {
  const authStore = useSettingsStore.getState().booruAuth;
  // Sankaku Books shares the regular Sankaku SSO session. Keep its old key as
  // a fallback so existing users do not need to authenticate again.
  const imageAuth = authStore?.sankaku;
  const booksAuth = authStore?.['sankaku-books'];
  const auth = {
    ...booksAuth,
    ...imageAuth,
    sessionCookies: imageAuth?.sessionCookies || booksAuth?.sessionCookies,
    localStorage: {
      ...(booksAuth?.localStorage || {}),
      ...(imageAuth?.localStorage || {}),
    },
  };
  const headers: Record<string, string> = {};

  if (auth?.sessionCookies?.trim()) {
    headers.Cookie = auth.sessionCookies.trim();
  }

  const token = auth?.localStorage?.access_token || auth?.localStorage?.token;
  const accessToken = token || auth?.apiKey;
  if (accessToken?.trim()) {
    headers.Authorization = `Bearer ${accessToken.replace(/^"|"$/g, '')}`;
  }

  return headers;
}

export function hasSankakuAuth(headers = getSankakuAuthHeaders()): boolean {
  return Boolean(headers.Cookie || headers.Authorization);
}

export function sankakuApiUrls(path: string): string[] {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return SANKAKU_API_BASES.map(base => `${base}${normalizedPath}`);
}

export function normalizeSankakuTag(tag: string): string {
  return tag.trim().replace(/\s+/g, '_');
}

export function mapSankakuTags(tags: SankakuTag[] | undefined): SankakuTagBuckets {
  const buckets: SankakuTagBuckets = {
    all: [],
    artist: [],
    character: [],
    copyright: [],
    general: [],
    meta: [],
  };

  for (const tag of tags || []) {
    const name = normalizeSankakuTag(tag.name_en || tag.name || '');
    if (!name) continue;
    const type = Number(tag.type);
    buckets.all.push(name);
    if (type === 1) buckets.artist.push(name);
    else if (type === 3) buckets.copyright.push(name);
    else if (type === 4) buckets.character.push(name);
    else if (type === 5) buckets.meta.push(name);
    else buckets.general.push(name);
  }

  for (const key of Object.keys(buckets) as Array<keyof SankakuTagBuckets>) {
    buckets[key] = Array.from(new Set(buckets[key]));
  }
  return buckets;
}

export function mapSankakuRating(rating?: string): 'safe' | 'questionable' | 'explicit' | 'unknown' {
  if (rating === 's') return 'safe';
  if (rating === 'q') return 'questionable';
  if (rating === 'e') return 'explicit';
  return 'unknown';
}

export function parseSankakuCreatedAt(value: SankakuPost['created_at']): number | undefined {
  if (typeof value === 'number') return value > 10_000_000_000 ? value : value * 1000;
  if (typeof value === 'object' && value) {
    const seconds = value.s ?? value.n;
    return typeof seconds === 'number' ? seconds * 1000 : undefined;
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

export function parseSankakuCreatedAtIso(value: SankakuPost['created_at']): string {
  return new Date(parseSankakuCreatedAt(value) || Date.now()).toISOString();
}

export function getSankakuGroupInfo(post: SankakuPost): SankakuGroupInfo {
  const poolIds = Array.from(new Set([
    ...(post.pool_ids || []),
    ...(post.pool_id !== undefined && post.pool_id !== null ? [post.pool_id] : []),
  ].map(String)));
  const bookIds = Array.from(new Set([
    ...(post.book_ids || []),
    ...(post.book_id !== undefined && post.book_id !== null ? [post.book_id] : []),
  ].map(String)));
  const parentId = post.parent_id !== undefined && post.parent_id !== null ? String(post.parent_id) : undefined;
  const sequence = post.sequence === undefined || post.sequence === null ? undefined : Number(post.sequence);

  if (bookIds[0]) return { relatedGroupId: `sankaku-book-${bookIds[0]}`, relatedIndex: sequence, parentId, poolIds, bookIds };
  if (poolIds[0]) return { relatedGroupId: `sankaku-pool-${poolIds[0]}`, relatedIndex: sequence, parentId, poolIds, bookIds };
  if (parentId) return { relatedGroupId: `sankaku-parent-${parentId}`, relatedIndex: sequence, parentId, poolIds, bookIds };
  return { relatedIndex: sequence, parentId, poolIds, bookIds };
}

export function getSankakuMediaType(post: SankakuPost): 'image' | 'video' | 'gif' {
  const fileType = (post.file_type || '').toLowerCase();
  const url = post.file_url || post.sample_url || post.preview_url || '';
  if (fileType.startsWith('video/') || /\.(mp4|webm|ogv|swf)(?:\?|$)/i.test(url)) return 'video';
  if (fileType === 'image/gif' || /\.gif(?:\?|$)/i.test(url)) return 'gif';
  return 'image';
}

export function getSankakuMediaStatus(post: SankakuPost): 'available' | 'login_required' | 'premium_required' | 'unavailable' {
  if (post.redirect_to_signup) return 'login_required';
  if (post.is_premium && !post.file_url && !post.sample_url && !post.preview_url) return 'premium_required';
  if (post.file_url || post.sample_url || post.preview_url) return 'available';
  return 'unavailable';
}

export function getSankakuSourceUrl(id: string | number): string {
  return `${SANKAKU_WEB_BASE}/en/posts/${id}`;
}

export function unwrapSankakuPosts(value: unknown): SankakuPost[] {
  if (Array.isArray(value)) return value as SankakuPost[];
  if (value && typeof value === 'object' && Array.isArray((value as { data?: unknown }).data)) {
    return (value as { data: SankakuPost[] }).data;
  }
  return [];
}
