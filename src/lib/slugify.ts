export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w-]+/g, "") // Remove all non-word chars
    .replace(/--+/g, "-") // Replace multiple - with single -
    .replace(/^-+/, "") // Trim - from start of text
    .replace(/-+$/, ""); // Trim - from end of text
}

export function generateUniqueSlug(title: string, checkExists: (slug: string) => Promise<boolean>): Promise<string> {
  const baseSlug = slugify(title);
  const finalSlug = baseSlug;
  let counter = 1;

  const getValidSlug = async (slug: string): Promise<string> => {
    const exists = await checkExists(slug);
    if (!exists) return slug;
    
    const nextSlug = `${baseSlug}-${counter++}`;
    return getValidSlug(nextSlug);
  };

  return getValidSlug(finalSlug);
}
