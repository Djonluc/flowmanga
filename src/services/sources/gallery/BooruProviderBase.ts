import { invoke } from "@tauri-apps/api/core";
import type { SourceSearchResult } from "../types";

const BOORU_USER_AGENT =
  "FlowManga/2.2.0 (djonstnix; https://github.com/djonstnix/flowmanga)";

function buildApiUrl(baseUrl: string, endpoint: string): URL {
  const url = endpoint.startsWith("http")
    ? new URL(endpoint)
    : new URL(`${baseUrl}${endpoint}`);
  if (!url.pathname.endsWith(".json")) {
    const normalizedPath = url.pathname.endsWith("/")
      ? url.pathname.slice(0, -1)
      : url.pathname;
    url.pathname = `${normalizedPath}.json`;
  }
  return url;
}

export async function booruGet(
  baseUrl: string,
  endpoint: string,
  params: Record<string, any> = {},
) {
  const url = buildApiUrl(baseUrl, endpoint);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  try {
    const response: any = await invoke("fetch_json", {
      url: url.toString(),
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": BOORU_USER_AGENT,
      },
    });

    return response || [];
  } catch (error) {
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

export function normalizeBooruPost(
  post: any,
  source: string,
  baseUrl: string,
): SourceSearchResult {
  const fullUrl =
    post.file_url ||
    post.large_file_url ||
    post.jpeg_url ||
    post.source_url ||
    post.preview_url ||
    "";
  const previewUrl =
    post.preview_url || post.sample_url || post.jpeg_url || fullUrl;
  const imageUrl =
    post.jpeg_url || post.large_file_url || post.file_url || fullUrl;
  const tags =
    typeof post.tags === "string"
      ? post.tags.split(" ").filter(Boolean)
      : Array.isArray(post.tags)
        ? post.tags
        : [];

  return {
    id: `${source}-${post.id}`,
    title:
      post.tag_string?.split(" ").slice(0, 3).join(" ") || `Image ${post.id}`,
    coverUrl: previewUrl,
    previewUrl,
    imageUrl,
    fullResUrl: imageUrl,
    width: post.width,
    height: post.height,
    tags,
    source,
    contentType: "gallery",
    url: `${baseUrl}/posts/${post.id}`,
    rating: normalizeRating(post.rating),
    popularity: Number(post.score || post.fav_count || 0),
    createdAt: post.created_at,
  };
}

export function mapBooruPosts(
  data: any,
  source: string,
  baseUrl: string,
): SourceSearchResult[] {
  const items = Array.isArray(data) ? data : [data];
  return items
    .filter(
      (item) =>
        item &&
        item.id &&
        (item.file_url ||
          item.large_file_url ||
          item.jpeg_url ||
          item.preview_url),
    )
    .map((item) => normalizeBooruPost(item, source, baseUrl));
}

export function buildBooruTags(
  query: string,
  contentFilter: "sfw" | "all" = "all",
) {
  const trimmed = query?.trim() || "";
  const ratingTag = contentFilter === "sfw" ? "rating:s" : "";
  return [trimmed, ratingTag].filter(Boolean).join(" ").trim();
}
