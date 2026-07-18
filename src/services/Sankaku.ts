import { useSettingsStore } from '../stores/useSettingsStore';
import { invoke } from '@tauri-apps/api/core';

// The public v2 API is hosted on sankakuapi.com. Keep the older alias as a
// fallback because some existing sessions and deployments still use it.
export const SANKAKU_API_BASES = [
  'https://sankakuapi.com',
  'https://capi-v2.sankakucomplex.com',
] as const;
// Sankaku's keyset feed uses a cursor instead of an increasingly expensive page offset.
export const SANKAKU_KEYSET_API_BASES = [
  'https://sankakuapi.com',
  'https://capi-v2.sankakucomplex.com',
] as const;
export const SANKAKU_WEB_BASE = 'https://chan.sankakucomplex.com';
export const SANKAKU_LOGIN_URL = 'https://login.sankakucomplex.com/login';
export const SANKAKU_BOOKS_URL = 'https://www.sankakucomplex.com/books';

// Both image engines use the same Sankaku API. Keep their traffic behind one
// queue so concurrent feeds cannot accidentally rate-limit one another.
const SANKAKU_MIN_REQUEST_INTERVAL_MS = 3_000;
const SANKAKU_FALLBACK_COOLDOWN_MS = 10 * 60_000;
let sankakuRequestTail: Promise<void> = Promise.resolve();
let sankakuLastRequestStartedAt = 0;
let sankakuBackoffUntil = 0;

export class SankakuRateLimitError extends Error {
  readonly retryAt: number;

  constructor(retryAt: number) {
    super(`Sankaku is rate-limited until ${new Date(retryAt).toLocaleTimeString()}.`);
    this.name = 'SankakuRateLimitError';
    this.retryAt = retryAt;
  }
}

function getSankakuRetryAt(error: unknown): number | undefined {
  const message = String(error);
  if (!/\b429\b|too many requests|rate.?limit/i.test(message)) return undefined;

  const retryAfter = message.match(/retry-after\s*[=:]\s*(\d+(?:\.\d+)?)/i);
  if (retryAfter) return Date.now() + Math.ceil(Number(retryAfter[1]) * 1000);

  const reset = message.match(/x-ratelimit-reset\s*[=:]\s*(\d+(?:\.\d+)?)/i);
  if (reset) {
    const value = Number(reset[1]);
    if (Number.isFinite(value)) return value >= 1_000_000_000 ? Math.ceil(value * 1000) : Date.now() + Math.ceil(value * 1000);
  }

  return Date.now() + SANKAKU_FALLBACK_COOLDOWN_MS;
}

export async function runSankakuRequest<T>(operation: () => Promise<T>): Promise<T> {
  const previous = sankakuRequestTail;
  let release: () => void = () => undefined;
  sankakuRequestTail = new Promise<void>(resolve => { release = resolve; });
  await previous;
  try {
    if (sankakuBackoffUntil > Date.now()) throw new SankakuRateLimitError(sankakuBackoffUntil);
    const spacingMs = sankakuLastRequestStartedAt + SANKAKU_MIN_REQUEST_INTERVAL_MS - Date.now();
    if (spacingMs > 0) await new Promise(resolve => setTimeout(resolve, spacingMs));
    if (sankakuBackoffUntil > Date.now()) throw new SankakuRateLimitError(sankakuBackoffUntil);
    sankakuLastRequestStartedAt = Date.now();
    return await operation();
  } catch (error) {
    // Record the cooldown before releasing the queue so a following request
    // cannot slip through during the same microtask turn.
    noteSankakuRateLimit(error);
    throw error;
  } finally {
    await new Promise(resolve => setTimeout(resolve, 250));
    release();
  }
}

export function noteSankakuRateLimit(error: unknown): void {
  const retryAt = getSankakuRetryAt(error);
  if (retryAt) sankakuBackoffUntil = Math.max(sankakuBackoffUntil, retryAt);
}

export function isSankakuRateLimited(error: unknown): boolean {
  return error instanceof SankakuRateLimitError || getSankakuRetryAt(error) !== undefined;
}

export function isSankakuRequestRejected(error: unknown): boolean {
  return /\b400\b|\b401\b|\b403\b|bad request|unauthorized|forbidden/i.test(String(error));
}

export function isSankakuAuthenticationRejected(error: unknown): boolean {
  return /\b401\b|\b403\b|unauthorized|forbidden/i.test(String(error));
}

export function isSankakuCoolingDown(): boolean {
  return sankakuBackoffUntil > Date.now();
}

export function getSankakuCooldownUntil(): number | undefined {
  return isSankakuCoolingDown() ? sankakuBackoffUntil : undefined;
}

export interface SankakuTag {
  name?: string;
  name_en?: string;
  tagName?: string;
  type?: number | string;
}

export interface SankakuTagSuggestion {
  tag: string;
  label: string;
  type: 'general' | 'artist' | 'studio' | 'copyright' | 'character' | 'genre' | 'medium' | 'meta' | 'unknown';
  postCount: number;
}

interface SankakuAutocompleteTag {
  tagName?: string;
  name?: string;
  name_en?: string;
  type?: number | string;
  count?: number;
  post_count?: number;
}

const sankakuSuggestionCache = new Map<string, { expiresAt: number; suggestions: SankakuTagSuggestion[] }>();

function getSankakuTagType(type: SankakuAutocompleteTag['type']): SankakuTagSuggestion['type'] {
  const value = typeof type === 'string' ? type.toLowerCase() : type;
  if (value === 1 || value === 'artist') return 'artist';
  if (value === 2 || value === 'studio' || value === 'circle') return 'studio';
  if (value === 3 || value === 'copyright' || value === 'series') return 'copyright';
  if (value === 4 || value === 'character' || value === 'entity') return 'character';
  if (value === 5 || value === 'genre') return 'genre';
  if (value === 8 || value === 'medium') return 'medium';
  if (value === 9 || value === 'meta') return 'meta';
  if (value === 0 || value === 'general') return 'general';
  return 'unknown';
}

/**
 * Resolves suggestions against Sankaku's own tag catalog. This is intentionally
 * not a shared booru alias list: each source owns its own vocabulary.
 */
export async function getSankakuTagSuggestions(query: string): Promise<SankakuTagSuggestion[]> {
  const normalized = query.trim().replace(/^-?(?:artist|studio|character|series|copyright|genre|meta):/i, '').replace(/\s+/g, '_').toLowerCase();
  if (normalized.length < 2 || isSankakuCoolingDown()) return [];

  const cached = sankakuSuggestionCache.get(normalized);
  if (cached && cached.expiresAt > Date.now()) return cached.suggestions;

  let lastError: unknown;
  for (const endpoint of sankakuApiUrls('/tags/autosuggestCreating')) {
    const url = new URL(endpoint);
    url.searchParams.set('tag', normalized);
    url.searchParams.set('show_meta', '0');
    url.searchParams.set('target', 'post');
    try {
      const response = await runSankakuRequest(() => invoke<unknown>('fetch_json', {
        url: url.toString(),
        method: 'GET',
        headers: getSankakuRequestHeaders(),
        proxyUrl: useSettingsStore.getState().networkProxy || null,
      }));
      const suggestions = (Array.isArray(response) ? response : [])
        .map(item => item as SankakuAutocompleteTag)
        .map(item => {
          const tag = normalizeSankakuTag(item.tagName || item.name || item.name_en || '');
          return {
            tag,
            label: item.name_en || item.name || tag,
            type: getSankakuTagType(item.type),
            postCount: Number(item.post_count ?? item.count ?? 0),
          };
        })
        .filter((item): item is SankakuTagSuggestion => Boolean(item.tag))
        .slice(0, 12);
      sankakuSuggestionCache.set(normalized, { suggestions, expiresAt: Date.now() + 5 * 60_000 });
      return suggestions;
    } catch (error) {
      lastError = error;
      noteSankakuRateLimit(error);
      if (isSankakuRequestRejected(error) || isSankakuRateLimited(error)) break;
    }
  }

  if (lastError && !isSankakuRateLimited(lastError)) {
    console.info('[Sankaku] Tag suggestions are temporarily unavailable.');
  }
  return [];
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
  gif_preview_url?: string;
  video_url?: string;
  stream_url?: string;
  file_ext?: string;
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
  tag_names?: string[];
  has_children?: boolean;
  is_premium?: boolean;
  redirect_to_signup?: boolean;
  video_duration?: number;
  total_score?: number;
  score?: number;
  fav_count?: number;
  recommended_posts?: Array<number | string>;
}

export interface SankakuKeysetResponse {
  data?: SankakuPost[];
  meta?: { next?: string | null };
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

  const token = auth?.localStorage?.access_token
    || auth?.localStorage?.accessToken
    || auth?.localStorage?.token
    || extractSankakuCookie(auth?.sessionCookies, ['accessToken', 'access_token', 'access-token']);
  const accessToken = token || auth?.apiKey;
  if (accessToken?.trim()) {
    headers.Authorization = `Bearer ${accessToken.replace(/^Bearer\s+/i, '').replace(/^"|"$/g, '')}`;
  }

  return headers;
}

export function getSankakuRequestHeaders(): Record<string, string> {
  return {
    Accept: 'application/vnd.sankaku.api+json;v=2',
    'Api-Version': '2',
    'Client-Type': 'non-premium',
    Origin: 'https://sankaku.app',
    Platform: 'web-app',
    Priority: 'u=1, i',
    Referer: 'https://sankaku.app/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    ...getSankakuAuthHeaders(),
  };
}

/** Public-feed headers used when a saved Sankaku session has expired. */
export function getSankakuPublicRequestHeaders(): Record<string, string> {
  const headers = getSankakuRequestHeaders();
  delete headers.Authorization;
  delete headers.Cookie;
  return headers;
}

function extractSankakuCookie(cookieHeader: string | undefined, names: string[]): string | undefined {
  if (!cookieHeader) return undefined;
  const wanted = new Set(names.map(name => name.toLowerCase()));
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    if (!wanted.has(name.toLowerCase())) continue;
    const value = part.slice(separator + 1).trim();
    if (!value) continue;
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return undefined;
}

export function hasSankakuAuth(headers = getSankakuAuthHeaders()): boolean {
  return Boolean(headers.Cookie || headers.Authorization);
}

export interface SankakuSessionStatus {
  state: 'authenticated' | 'anonymous' | 'invalid' | 'unavailable';
  username?: string;
  hasCookies: boolean;
  hasToken: boolean;
  message: string;
}

export async function verifySankakuSession(): Promise<SankakuSessionStatus> {
  const headers = getSankakuAuthHeaders();
  const hasCookies = Boolean(headers.Cookie);
  const hasToken = Boolean(headers.Authorization);
  if (!hasCookies && !hasToken) {
    return { state: 'anonymous', hasCookies, hasToken, message: 'No Sankaku session has been captured.' };
  }

  try {
    const response = await invoke<unknown>('fetch_json', {
      url: 'https://sankakuapi.com/users/me?lang=en',
      method: 'GET',
      headers: { ...getSankakuRequestHeaders(), ...headers },
      proxyUrl: null,
    });
    const record = response && typeof response === 'object' ? response as { user?: { name?: string }; name?: string } : {};
    const username = record.user?.name || record.name;
    return {
      state: 'authenticated',
      username,
      hasCookies,
      hasToken,
      message: username ? `Connected as ${username}.` : 'Sankaku accepted the session.',
    };
  } catch (error) {
    const message = typeof error === 'string' ? error : error instanceof Error ? error.message : String(error);
    const invalid = /401|403|unauthorized|forbidden/i.test(message);
    return {
      state: invalid ? 'invalid' : 'unavailable',
      hasCookies,
      hasToken,
      message: invalid ? 'Sankaku rejected the captured session.' : `Could not verify Sankaku: ${message}`,
    };
  }
}

export function sankakuApiUrls(path: string): string[] {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return SANKAKU_API_BASES.map(base => `${base}${normalizedPath}`);
}

export function sankakuKeysetApiUrls(path: string): string[] {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return SANKAKU_KEYSET_API_BASES.map(base => `${base}${normalizedPath}`);
}

export function normalizeSankakuTag(tag: string): string {
  return tag.trim().replace(/\s+/g, '_');
}

// Sankaku's canonical vocabulary does not always match the words people use
// in search. Keep this narrowly curated: aliases must be genuine equivalents,
// never a guess that broadens an explicit search into a different theme.
const SANKAKU_TAG_ALIASES: Readonly<Record<string, string>> = {
  'cross-dresser': 'crossdressing',
  cross_dresser: 'crossdressing',
  crossdress: 'crossdressing',
  crossdresser: 'crossdressing',
  crossdressers: 'crossdressing',
  boylove: 'boy_love',
  'boys-love': 'boy_love',
  boys_love: 'boy_love',
  femboy: 'trap',
  femboys: 'trap',
  traps: 'trap',
  transgendered: 'transgender',
};

export function canonicalizeSankakuTag(value: string): string {
  const normalized = normalizeSankakuTag(value).toLowerCase();
  return SANKAKU_TAG_ALIASES[normalized] || normalized;
}

export type SankakuTypedTagCategory = 'artist' | 'character' | 'copyright' | 'meta';

export interface SankakuTypedTag {
  category: SankakuTypedTagCategory;
  tag: string;
}

export function parseSankakuTypedTag(value: string): SankakuTypedTag | null {
  const match = value.trim().replace(/^-/, '').match(/^(artist|studio|character|series|copyright|genre|meta):(.+)$/i);
  if (!match) return null;
  const rawCategory = match[1].toLowerCase();
  const category: SankakuTypedTagCategory = rawCategory === 'artist' || rawCategory === 'studio'
    ? 'artist'
    : rawCategory === 'character'
      ? 'character'
      : rawCategory === 'meta'
        ? 'meta'
        : 'copyright';
  return { category, tag: normalizeSankakuTag(match[2]) };
}

export function normalizeSankakuSearchTag(value: string): string {
  const negative = value.trim().startsWith('-');
  const typed = parseSankakuTypedTag(value);
  const tag = canonicalizeSankakuTag(typed ? typed.tag : value.replace(/^-/, ''));
  return negative ? `-${tag}` : tag;
}

export function mapSankakuTags(tags: SankakuTag[] | string[] | undefined, tagNames: string[] | undefined = undefined): SankakuTagBuckets {
  const buckets: SankakuTagBuckets = {
    all: [],
    artist: [],
    character: [],
    copyright: [],
    general: [],
    meta: [],
  };

  const structuredTags = (tags || []).map(tag => typeof tag === 'string' ? { name: tag } : tag);
  const structuredNames = new Set(structuredTags.map(tag => normalizeSankakuTag(tag.tagName || tag.name_en || tag.name || '').toLowerCase()));
  const normalizedTags: SankakuTag[] = [
    ...structuredTags,
    ...(tagNames || [])
      .filter(name => !structuredNames.has(normalizeSankakuTag(name).toLowerCase()))
      .map(name => ({ name })),
  ];

  for (const tag of normalizedTags) {
    // `tagName` is the canonical query-safe value. `name_en`/`name` are
    // display labels and may contain spaces, capitalization, or punctuation.
    const name = normalizeSankakuTag(tag.tagName || tag.name_en || tag.name || '');
    if (!name) continue;
    const type = typeof tag.type === 'string' ? tag.type.toLowerCase() : Number(tag.type);
    buckets.all.push(name);
    if (type === 1 || type === 2 || type === 'artist' || type === 'circle' || type === 'studio') buckets.artist.push(name);
    else if (type === 3 || type === 'copyright' || type === 'series' || type === 'genre') buckets.copyright.push(name);
    else if (type === 4 || type === 'character' || type === 'entity') buckets.character.push(name);
    else if (type === 5) buckets.copyright.push(name);
    else if (type === 8 || type === 9 || type === 'meta' || type === 'medium' || type === 'activity') buckets.meta.push(name);
    else buckets.general.push(name);
  }

  for (const key of Object.keys(buckets) as Array<keyof SankakuTagBuckets>) {
    buckets[key] = Array.from(new Set(buckets[key]));
  }
  return buckets;
}

export function isSankakuApprovedPost(post: SankakuPost): boolean {
  if (!post.status) return true;
  const status = post.status.toLowerCase();
  // The API already applies the current user's visibility rules. Preserve
  // visible workflow states shown by the website and reject only explicit
  // removal states.
  return !['deleted', 'hidden', 'banned', 'blocked', 'removed'].includes(status);
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
  const url = post.video_url || post.stream_url || post.file_url || post.sample_url || post.gif_preview_url || post.preview_url || '';
  if (fileType.startsWith('video/') || /\.(mp4|webm|ogv|swf)(?:\?|$)/i.test(url)) return 'video';
  if (fileType === 'image/gif' || /\.gif(?:\?|$)/i.test(url)) return 'gif';
  return 'image';
}

export function getSankakuMediaStatus(post: SankakuPost): 'available' | 'login_required' | 'premium_required' | 'unavailable' {
  if (!isSankakuApprovedPost(post)) return 'unavailable';
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
