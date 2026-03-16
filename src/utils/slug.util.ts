import slugify from 'slugify';

/**
 * Generates a URL-friendly slug from a given string.
 * @param text The input string to slugify.
 * @returns The generated slug.
 */
export function generateSlug(text: string): string {
  return slugify(text, {
    lower: true, // Convert to lower case
    strict: true, // Strip special characters except those allowed
    locale: 'en', // Language for character conversions
  });
}
