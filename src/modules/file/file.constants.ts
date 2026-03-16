/**
 * File Service Constants
 * Defines allowed filters and searchable fields for file queries
 */

export const FILE_ALLOWED_FILTERS = ['mimeType', 'provider'] as const;

export const FILE_SEARCHABLE_FIELDS = ['filename', 'mimeType', 'url'] as const;

export const FILE_ALLOWED_SORT_FIELDS = ['filename', 'size', 'createdAt'] as const;
