import { ApiError } from '@core/error.classes';

/**
 * Validates the content of a file buffer against its claimed MIME type using magic bytes.
 * Uses dynamic import for 'file-type' to handle ESM compatibility in CommonJS environments.
 * @param fileBuffer The buffer of the file to check.
 * @param claimedMimeType The MIME type claimed by the client/extension.
 */
export const validateFileContent = async (
  fileBuffer: Buffer,
  claimedMimeType: string,
): Promise<void> => {
  // Dynamic import for ESM module
  const { fileTypeFromBuffer } = await import('file-type');
  const detectedType = await fileTypeFromBuffer(fileBuffer);

  // If detectedType is undefined, it means file-type couldn't identify it.
  // This is common for plain text files (CSV, etc.) which don't have reliable magic bytes.
  // However, images and PDFs MUST be detected.
  if (!detectedType) {
    if (
      claimedMimeType.startsWith('image/') ||
      claimedMimeType === 'application/pdf' ||
      claimedMimeType.includes('zip') || // Office docs are often zips
      claimedMimeType.includes('compressed')
    ) {
      // If it claims to be a binary format we support but we can't detect it, it's likely malformed or fake.
      // Note: older Office docs (.doc) might not be detected reliably by all versions, but .docx are zips.
      // Let's be strict for Images and PDFs.
      if (claimedMimeType.startsWith('image/') || claimedMimeType === 'application/pdf') {
        throw ApiError.BadRequest(
          'File content validation failed: Could not determine file signature.',
          'file.invalid_signature',
        );
      }
    }
    // For other types (text/csv, etc.), we pass if we can't detect.
    return;
  }

  // If we detected a type, ensure it matches the claimed type.
  // Note: mimetype from multer might be 'image/jpeg' while detection says 'image/jpeg'.
  // Some browsers might send specific variants.
  // We check if the detected mime is allowed.

  // We should strictly check against the CLAIMED mime type to prevent extension spoofing.
  // e.g. user uploads 'malware.exe' renamed to 'image.jpg'. Claimed is 'image/jpeg'.
  // Detected should be 'application/x-dosexec' -> mismatch -> error.

  if (detectedType.mime !== claimedMimeType) {
    // Edge cases:
    // 1. jpg vs jpeg: both are image/jpeg.
    // 2. docx is application/vnd.openxml... but might be detected as application/zip.
    // file-type handles standard office docs nicely usually.

    // Allow xml/zip for office docs if needed, but 'file-type' usually returns the specific office mime.

    // Exception for specific cases where detection might be more specific or generic logic applies
    // const isOfficeDoc = claimedMimeType.includes('openxmlformats') || claimedMimeType.includes('msword');

    // If it's an image, be strict.
    if (claimedMimeType.startsWith('image/') && detectedType.mime.startsWith('image/')) {
      // Allow image/jpeg matching image/jpg etc (usually mime matches exactly)
    }

    // Simplest strict check:
    if (detectedType.mime !== claimedMimeType) {
      // Debug: console.log(`Mismatch: Claimed ${claimedMimeType}, Detected ${detectedType.mime}`);

      // Handle office files special case: file-type detects them well, but let's be careful.
      // If usage shows strict equality fails, we will refine.
      // For now, strict check is safest.
      // EXCEPTION: 'application/x-zip-compressed' vs 'application/zip' etc.

      throw ApiError.BadRequest(
        `File content validation failed: Detected type ${detectedType.mime} does not match allowed type ${claimedMimeType}.`,
        'file.content_mismatch',
      );
    }
  }
};
