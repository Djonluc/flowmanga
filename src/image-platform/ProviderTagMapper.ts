import type { SearchQuery } from './types';

const CATEGORY_PREFIX = /^(artist|character|series|copyright|general):(.+)$/i;
const CONTROL_TAG = /^(?:order|sort|score|rating|random):/i;

function splitCategory(tag: string): { category?: string; value: string } {
  const match = tag.trim().match(CATEGORY_PREFIX);
  return match ? { category: match[1].toLowerCase(), value: match[2] } : { value: tag.trim() };
}

function booruTag(tag: string): string {
  if (CONTROL_TAG.test(tag)) return tag.toLowerCase();
  const { value } = splitCategory(tag);
  return value.toLowerCase().trim().replace(/[\s-]+/g, '_');
}

function sankakuTag(tag: string): string {
  if (CONTROL_TAG.test(tag)) return tag.toLowerCase();
  const { category, value } = splitCategory(tag);
  const normalized = value.toLowerCase().trim().replace(/[\s-]+/g, '_');
  return category ? `${category}:${normalized}` : normalized;
}

function zerochanTag(tag: string): string {
  const { value } = splitCategory(tag);
  return value.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

function eHentaiTag(tag: string): string {
  const { category, value } = splitCategory(tag);
  const normalized = value.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  const namespace = category === 'series' || category === 'copyright' ? 'parody' : category;
  return namespace ? `${namespace}:"${normalized}$"` : normalized;
}

/** Converts the app's canonical tags into the syntax expected by each provider. */
export function mapQueryForProvider(query: SearchQuery, providerId: string): SearchQuery {
  const mapTag = providerId === 'e-hentai'
    ? eHentaiTag
    : providerId === 'sankaku'
      ? sankakuTag
    : providerId === 'zerochan'
      ? zerochanTag
      : booruTag;
  const positiveTags = Array.from(new Set(query.positiveTags.map(mapTag).filter(Boolean)));
  const negativeTags = Array.from(new Set(query.negativeTags.map(mapTag).filter(Boolean)));
  return {
    ...query,
    positiveTags,
    negativeTags,
    raw: [...positiveTags, ...negativeTags.map(tag => `-${tag}`)].join(' '),
  };
}
