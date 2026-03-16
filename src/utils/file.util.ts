import env from '@config/env';

export interface TFileDocument {
  id: string;
  filename: string;
  mimeType: string;
  extension: string;
  checksum: string;
  size: number;
  file_type: string;
  path?: string | null;
  url: string;
  provider: string;
  visibility: 'public' | 'private';
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Dynamically generates a file URL based on the storage provider and file data
 * @param src - File document, URL string, or null/undefined
 * @returns Resolved file URL or placeholder
 */
export default function fileObjectToLink(src: TFileDocument | string | null | undefined): string {
  // Handle null/undefined cases
  if (!src) {
    return '/placeholder.png';
  }

  // Handle direct URL strings
  if (typeof src === 'string') {
    return src;
  }

  // Handle file objects
  if (typeof src === 'object') {
    // If it's already a TFileDocument with a URL, use it directly
    if ('url' in src && src.url) {
      return src.url;
    }

    // If it's a TFileDocument with a path, construct URL based on provider
    if ('path' in src && src.path) {
      switch (src.provider?.toUpperCase()) {
        case 'LOCAL': {
          // For local storage, use the appropriate base URL based on environment
          const baseUrl =
            env.LOCAL_STORAGE_BASE_URL ||
            (env.NODE_ENV === 'production'
              ? env.LOCAL_STORAGE_BASE_URL_PROD || 'https://api.zlivoo.com'
              : env.LOCAL_STORAGE_BASE_URL_DEV || 'http://localhost:5000');
          return `${baseUrl}${src.path}`;
        }

        case 'S3': {
          // For S3, construct the URL using bucket and region info
          if (env.AWS_S3_BUCKET_NAME && env.AWS_REGION) {
            return `https://${env.AWS_S3_BUCKET_NAME}.s3.${env.AWS_REGION}.amazonaws.com${src.path}`;
          }
          // Fallback to the path if we can't construct the full URL
          return src.path;
        }

        case 'CLOUDINARY': {
          // For Cloudinary, the path might be the public ID
          // In a real implementation, you might need to construct the full URL
          // This is a simplified version - you might need to adjust based on your Cloudinary setup
          return src.path || '/placeholder.png';
        }

        default: {
          // For unknown providers, try to use path directly or fallback
          return src.path || '/placeholder.png';
        }
      }
    }
  }

  // Fallback for any other case
  return '/placeholder.png';
}

/**
 * Get file category based on MIME type
 * @param mimeType - MIME type of the file
 * @returns File category (image, video, audio, pdf, document, text, other)
 */
export function getFileCategory(mimeType: string): string {
  const FILE_TYPE_CATEGORIES: Record<string, string[]> = {
    image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
    video: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'],
    audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/aac'],
    pdf: ['application/pdf'],
    document: [
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ],
    text: ['text/plain', 'text/csv'],
  };

  for (const [category, mimeTypes] of Object.entries(FILE_TYPE_CATEGORIES)) {
    if (mimeTypes.includes(mimeType)) {
      return category;
    }
  }

  return 'other';
}

/**
 * Check if a file is an image
 * @param src - File document or URL string
 * @returns True if the file is an image, false otherwise
 */
export function isImageFile(src: TFileDocument | string | null | undefined): boolean {
  if (!src) return false;

  if (typeof src === 'string') {
    // Simple check for common image extensions in URLs
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    return imageExtensions.some((ext) => src.toLowerCase().includes(ext));
  }

  if (typeof src === 'object' && 'mimeType' in src) {
    return src.mimeType.startsWith('image/');
  }

  return false;
}
