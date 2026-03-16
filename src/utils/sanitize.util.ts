/**
 * Sanitize search input to prevent query injection
 * @param input - The search string to sanitize
 * @returns Sanitized search string
 */
export const sanitizeSearchInput = (input: string): string => {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove special regex characters that could cause issues
  // Allow only alphanumeric, spaces, and common punctuation
  return input
    .trim()
    .replace(/[^\w\s\-_.@]/gi, '') // Remove special characters except common ones
    .substring(0, 100); // Limit length to prevent excessive queries
};

/**
 * Sanitize numeric input
 * @param input - The input to convert to number
 * @param defaultValue - Default value if conversion fails
 * @returns Sanitized number
 */
export const sanitizeNumericInput = (input: any, defaultValue: number = 0): number => {
  const num = Number(input);
  return isNaN(num) || !isFinite(num) ? defaultValue : num;
};

/**
 * Sanitize boolean input
 * @param input - The input to convert to boolean
 * @returns Boolean value
 */
export const sanitizeBooleanInput = (input: any): boolean | undefined => {
  if (input === undefined || input === null) {
    return undefined;
  }
  if (typeof input === 'boolean') {
    return input;
  }
  if (typeof input === 'string') {
    return input.toLowerCase() === 'true';
  }
  return undefined;
};
