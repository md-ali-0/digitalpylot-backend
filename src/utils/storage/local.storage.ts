/* eslint-disable @typescript-eslint/no-explicit-any */
import env from '@config/env';
import logger from '@config/winston';
import { ApiError } from '@core/error.classes';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { MulterFile } from 'src/types';
import { v4 as uuidv4 } from 'uuid';
import type { IStorageService } from './storage.interface';

const UPLOADS_DIR = path.join(__dirname, '../../../uploads');

// Define file type categories
const FILE_TYPE_CATEGORIES = {
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

// Ensure the main uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  logger.info(`Created uploads directory at: ${UPLOADS_DIR}`);
}

// Ensure category directories exist
Object.keys(FILE_TYPE_CATEGORIES).forEach((category) => {
  const categoryDir = path.join(UPLOADS_DIR, category);
  if (!fs.existsSync(categoryDir)) {
    fs.mkdirSync(categoryDir, { recursive: true });
    logger.info(`Created ${category} directory at: ${categoryDir}`);
  }
});

export class LocalStorageService implements IStorageService {
  private getCategoryByMimeType(mimeType: string): string {
    for (const [category, mimeTypes] of Object.entries(FILE_TYPE_CATEGORIES)) {
      if (mimeTypes.includes(mimeType)) {
        return category;
      }
    }
    return 'other'; // Default category for unknown file types
  }

  private getFileExtension(filename: string): string {
    return path.extname(filename).toLowerCase();
  }

  private generateChecksum(buffer: Buffer): string {
    return crypto.createHash('md5').update(buffer).digest('hex');
  }

  private getBaseUrl(): string {
    // If a specific base URL is set, use it
    if (env.LOCAL_STORAGE_BASE_URL) {
      return env.LOCAL_STORAGE_BASE_URL;
    }

    // Otherwise, use environment-specific defaults
    if (env.NODE_ENV === 'production') {
      return env.LOCAL_STORAGE_BASE_URL_PROD || 'https://api.zlivoo.com';
    } else {
      return env.LOCAL_STORAGE_BASE_URL_DEV || 'http://localhost:5000';
    }
  }

  async uploadFile(file: MulterFile): Promise<any> {
    const fileId = uuidv4();

    // Determine category based on MIME type
    const category = this.getCategoryByMimeType(file.mimetype);

    // Create category directory if it doesn't exist
    const categoryDir = path.join(UPLOADS_DIR, category);
    if (!fs.existsSync(categoryDir)) {
      fs.mkdirSync(categoryDir, { recursive: true });
      logger.info(`Created ${category} directory at: ${categoryDir}`);
    }

    // Preserve file extension
    const fileExtension = this.getFileExtension(file.originalname);
    const fileNameWithExtension = `${fileId}${fileExtension}`;
    const filePath = path.join(categoryDir, fileNameWithExtension);

    // Get the relative path for storage in the database
    const relativePath = `/uploads/${category}/${fileNameWithExtension}`;

    // Get the base URL for file access
    const baseUrl = this.getBaseUrl();
    const fileUrl = `${baseUrl}${relativePath}`;

    // Generate checksum for the file
    const checksum = this.generateChecksum(file.buffer);

    try {
      await fs.promises.writeFile(filePath, file.buffer);

      // Determine category based on MIME type for file_type field
      const fileType = this.getCategoryByMimeType(file.mimetype);

      // Return file info without creating DB record (file service will handle that)
      return {
        id: fileId,
        filename: file.originalname,
        mimeType: file.mimetype,
        size: BigInt(file.size),
        extension: fileExtension,
        file_type: fileType,
        checksum: checksum,
        visibility: 'public', // Default visibility
        path: relativePath, // Store relative path instead of absolute path
        url: fileUrl,
        provider: 'LOCAL',
      };
    } catch (error: any) {
      logger.error(`Error uploading file locally: ${error.message}`, error);
      throw ApiError.InternalServerError('Failed to upload file locally.', error.message);
    }
  }

  async getFileStream(
    fileId: string,
  ): Promise<{ stream: NodeJS.ReadableStream; mimeType: string; filename: string }> {
    // The file service should provide the file record to this method
    // For now, we'll throw an error indicating this needs to be called differently
    throw new Error(
      'Local storage getFileStream needs file record - should be called through file service with proper context',
    );
  }

  async deleteFile(fileId: string): Promise<void> {
    // The file service should handle database operations and provide necessary context
    // For now, we'll throw an error indicating this needs to be called differently
    throw new Error(
      'Local storage deleteFile needs file record - should be called through file service with proper context',
    );
  }
}
