import { invoke } from "@tauri-apps/api/core";
import type { SourceSearchResult } from "../types";

type BooruAuth = {
  apiKey?: string;
  userId?: string;
};

type BooruRequestParams = Record<
  string,
  string | number | boolean | null | undefined
> & { auth?: BooruAuth };

type BooruApiPost = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

const BOORU_USER_AGENT =
  "FlowManga/2.2.0 (djonstnix; https://github.com/djonstnix/flowmanga)";

function buildApiUrl(baseUrl: string, endpoint: string): URL {
  const url = endpoint.startsWith("http")
    ? new URL(endpoint)
    : new URL(`${baseUrl}${endpoint}`);

  const isDapi =
    url.pathname.endsWith("/index.php") ||
    url.searchParams.get("page") === "dapi";

  if (
    !url.pathname.toLowerCase().endsWith(".json") &&
    !endpoint.includes("?") &&
    !url.pathname.toLowerCase().includes("index.php")
  ) {
    const normalizedPath = url.pathname.endsWith("/")
      ? url.pathname.slice(0, -1)
      : url.pathname;
    url.pathname = `${normalizedPath}.json`;
  }

  if (isDapi && !url.searchParams.has("json")) {
    url.searchParams.set("json", "1");
  }

  return url;
}

export async function booruGet(
  baseUrl: string,
  endpoint: string,
  params: BooruRequestParams = {},
  customUserAgent?: string,
): Promise<unknown> {
  const url = buildApiUrl(baseUrl, endpoint);
  const isDapi =
    url.pathname.endsWith("/index.php") ||
    url.searchParams.get("page") === "dapi";

  const { auth, ...rest } = params;
  Object.entries(rest).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      // Only map 'page' to 'pid' for DAPI if it's a numeric index, not the 'dapi' module identifier
      const paramKey =
        key === "page" && isDapi && value !== "dapi" ? "pid" : key;
      url.searchParams.set(paramKey, String(value));
    }
  });

  if (auth) {
    const isDanbooru = url.toString().includes("danbooru");
    const idKey = isDanbooru ? "login" : "user_id";
    
    // Sanitize inputs: if the user pasted a full query string like "&api_key=...&user_id=...", extract the values
    const sanitize = (val: string) => {
      if (!val) return val;
      // Extract from &key=value or ?key=value
      const match = val.match(/(?:^|[?&])(?:api_key|user_id|login)=([^&]+)/);
      return match ? match[1] : val;
    };

    const cleanApiKey = sanitize(auth.apiKey || "");
    const cleanUserId = sanitize(auth.userId || "");

    if (cleanApiKey) url.searchParams.set("api_key", cleanApiKey);
    if (cleanUserId) url.searchParams.set(idKey, cleanUserId);
  }

  try {
    const response = await invoke<unknown>("fetch_json", {
      url: url.toString(),
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": customUserAgent || BOORU_USER_AGENT,
      },
    });

    return response ?? [];
  } catch (error) {
    if (error && String(error).includes("401")) {
      console.warn(`[BooruProviderBase] ${url.hostname} requires authentication. Please check your User ID and API Key in Settings > Sources.`);
    }
    console.error(
      `[BooruProviderBase] API Error for ${url.toString()}:`,
      error,
    );
    return [];
  }
}

function normalizeRating(rating: string | undefined) {
  if (!rating) return "unknown";
  if (rating === "s") return "safe";
  if (rating === "q") return "questionable";
  return "explicit";
}

export function normalizeBooruTag(tag: string) {
  return tag
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w\-:@~.()]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

export function buildBooruTagsFromArray(
  tags: string[],
  contentFilter: "sfw" | "all" = "all",
) {
  const normalizedTags = tags
    .map((tag) => normalizeBooruTag(tag))
    .filter(Boolean);
  const ratingTag = contentFilter === "sfw" ? "rating:s" : "";
  return [...normalizedTags, ratingTag].filter(Boolean).join(" ").trim();
}

function ensureAbsoluteUrl(url: string, baseUrl: string): string {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) {
    const base = new URL(baseUrl);
    return `${base.protocol}//${base.host}${url}`;
  }
  return url;
}

function normalizeBooruPost(
  post: BooruApiPost,
  source: string,
  baseUrl: string,
): SourceSearchResult {
  let fullUrl = ensureAbsoluteUrl(
    asString(post.file_url) ||
      asString(post.large_file_url) ||
      asString(post.jpeg_url) ||
      asString(post.source_url) ||
      asString(post.preview_url) ||
      "",
    baseUrl,
  );
  let previewUrl = ensureAbsoluteUrl(
    asString(post.preview_file_url) ||
      asString(post.preview_url) ||
      asString(post.sample_url) ||
      asString(post.jpeg_url) ||
      fullUrl,
    baseUrl,
  );
  let imageUrl = ensureAbsoluteUrl(
    asString(post.sample_url) ||
      asString(post.large_file_url) ||
      asString(post.jpeg_url) ||
      asString(post.file_url) ||
      fullUrl,
    baseUrl,
  );
  let fullResUrl = ensureAbsoluteUrl(
    asString(post.file_url) ||
      asString(post.large_file_url) ||
      asString(post.jpeg_url) ||
      fullUrl,
    baseUrl,
  );

  // Danbooru new API format uses media_asset variants
  if (isRecord(post.media_asset) && Array.isArray(post.media_asset.variants)) {
    const variants = post.media_asset.variants as Array<Record<string, unknown>>;
    const getVariant = (types: string[]) => {
      const variant = variants.find(v => types.includes(asString(v.type)));
      return variant ? ensureAbsoluteUrl(asString(variant.url), baseUrl) : null;
    };
    
    const variantPreview = getVariant(['360x360', '180x180']);
    if (variantPreview) previewUrl = variantPreview;
    
    const variantSample = getVariant(['sample', '720x720', 'original']);
    if (variantSample) imageUrl = variantSample;
    
    const variantOriginal = getVariant(['original']);
    if (variantOriginal) fullResUrl = variantOriginal;
  }

  const dedupeTags = (tagList: string[]) => [
    ...new Set(
      tagList
        .map((t) => t?.toLowerCase().trim())
        .filter(Boolean)
        .map((t) => normalizeBooruTag(t)),
    ),
  ];

  const rawTags =
    typeof post.tag_string === "string"
      ? post.tag_string.split(" ")
      : typeof post.tags === "string"
        ? post.tags.split(" ")
        : Array.isArray(post.tags)
          ? post.tags.filter((tag): tag is string => typeof tag === "string")
          : [];

  const tags = dedupeTags(rawTags);

  const generalTags = dedupeTags(
    typeof post.tag_string_general === "string"
      ? post.tag_string_general.split(" ")
      : [],
  );

  const characterTags = dedupeTags(
    typeof post.tag_string_character === "string"
      ? post.tag_string_character.split(" ")
      : typeof post.character_string === "string"
        ? post.character_string.split(" ")
        : [],
  );

  const copyrightTags = dedupeTags(
    typeof post.tag_string_copyright === "string"
      ? post.tag_string_copyright.split(" ")
      : typeof post.copyright_string === "string"
        ? post.copyright_string.split(" ")
        : [],
  );

  const artistTags = dedupeTags(
    typeof post.tag_string_artist === "string"
      ? post.tag_string_artist.split(" ")
      : typeof post.artist_string === "string"
        ? post.artist_string.split(" ")
        : [],
  );

  const metaTags = dedupeTags(
    typeof post.tag_string_meta === "string"
      ? post.tag_string_meta.split(" ")
      : [],
  );

  const postId =
    typeof post.id === "string"
      ? post.id
      : typeof post.id === "number"
        ? String(post.id)
        : "unknown";

  return {
    id: `${source}-${postId}`,
    title:
      asString(post.tag_string).split(" ").slice(0, 3).join(" ") ||
      `Image ${postId}`,
    coverUrl: previewUrl,
    previewUrl,
    imageUrl,
    fullResUrl,
    preview_url: previewUrl,
    sample_url: imageUrl,
    file_url: fullResUrl,
    width: asNumber(post.width),
    height: asNumber(post.height),
    tags,
    generalTags,
    characterTags,
    copyrightTags,
    artistTags,
    metaTags,
    source,
    provider: source,
    contentType: "gallery",
    mediaDomain: "image",
    url: `${baseUrl}/posts/${postId}`,
    rating: normalizeRating(asString(post.rating)),
    popularity: Number(asString(post.score) || asString(post.fav_count) || "0"),
    createdAt: asString(post.created_at),
  };
}

export function mapBooruPosts(
  data: unknown,
  source: string,
  baseUrl: string,
): SourceSearchResult[] {
  const items = Array.isArray(data) ? data : [data];
  return items
    .filter(
      (item): item is BooruApiPost =>
        isRecord(item) &&
        item.id !== undefined &&
        asString(item.status) !== "deleted" &&
        Boolean(
          asString(item.file_url) ||
          asString(item.large_file_url) ||
          asString(item.jpeg_url) ||
          asString(item.preview_url) ||
          asString(item.preview_file_url),
        ),
    )
    .map((item) => normalizeBooruPost(item, source, baseUrl));
}

export function buildBooruTags(
  query: string,
  contentFilter: "sfw" | "all" = "all",
) {
  const normalizedTokens = (query || "")
    .split(/\s+/)
    .map((tag) => normalizeBooruTag(tag))
    .filter(Boolean);
  const ratingTag = contentFilter === "sfw" ? "rating:s" : "";
  return [...normalizedTokens, ratingTag].join(" ").trim();
}
