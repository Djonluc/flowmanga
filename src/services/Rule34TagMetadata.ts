export type Rule34TagCategory =
  | "artist"
  | "character"
  | "copyright"
  | "general"
  | "meta";

const CATEGORY_BY_VALUE: Record<string, Rule34TagCategory | undefined> = {
  "0": "general",
  general: "general",
  gen: "general",
  "1": "artist",
  artist: "artist",
  art: "artist",
  "3": "copyright",
  copyright: "copyright",
  series: "copyright",
  "4": "character",
  character: "character",
  char: "character",
  "5": "meta",
  meta: "meta",
};

const categoryFromValue = (value: unknown): Rule34TagCategory | undefined => {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  return CATEGORY_BY_VALUE[String(value).toLowerCase()];
};

export const normalizeRule34TagCategory = categoryFromValue;

const tagNameFromValue = (value: unknown): string | null => {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return null;

  const record = value as Record<string, unknown>;
  for (const key of ["name", "tag", "value", "label"]) {
    if (typeof record[key] === "string") return record[key] as string;
  }
  return null;
};

/**
 * Parses Rule34's official `fields=tag_info` response into tag -> category.
 * The API has returned both category-keyed arrays and typed tag objects over
 * time, so this intentionally accepts both forms.
 */
export const parseRule34TagInfo = (
  tagInfo: unknown,
): Map<string, Rule34TagCategory> => {
  const categories = new Map<string, Rule34TagCategory>();

  const add = (value: unknown, inheritedCategory?: Rule34TagCategory) => {
    const directName = tagNameFromValue(value);
    if (directName) {
      const record = value && typeof value === "object"
        ? value as Record<string, unknown>
        : undefined;
      const category = categoryFromValue(
        record?.type ?? record?.category ?? record?.category_name,
      ) || inheritedCategory;
      if (category) categories.set(directName.toLowerCase(), category);
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(item => add(item, inheritedCategory));
      return;
    }

    if (!value || typeof value !== "object") return;
    Object.entries(value as Record<string, unknown>).forEach(([key, nested]) => {
      add(nested, categoryFromValue(key) || inheritedCategory);
    });
  };

  add(tagInfo);
  return categories;
};

export const addRule34Tag = (
  buckets: Record<Rule34TagCategory, string[]>,
  tag: string,
  category: Rule34TagCategory,
) => {
  buckets[category].push(tag);
};
