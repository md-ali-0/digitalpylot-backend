/* eslint-disable @typescript-eslint/no-explicit-any */
import env from '@config/env';
import logger from '@config/winston';
import { ApiError } from '@core/error.classes';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import crypto from 'crypto';
import path from 'path';
import { MulterFile } from 'src/types';
import type { IStorageService } from './storage.interface';

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

export class CloudinaryStorageService implements IStorageService {
  constructor() {
    if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
      logger.error('Cloudinary environment variables are not fully configured.');
      throw ApiError.InternalServerError('Cloudinary configuration missing.');
    }

    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
      secure: true, // Use HTTPS
    });
    logger.info('Cloudinary Storage Service initialized.');
  }

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

  async uploadFile(file: MulterFile): Promise<any> {
    try {
      // Upload buffer directly to Cloudinary with timeout handling
      const result = (await Promise.race([
        new Promise((resolve, reject) => {
          cloudinary.uploader
            .upload_stream(
              { resource_type: 'auto' }, // auto-detect file type
              (error, result) => {
                if (error) return reject(error);
                if (!result) return reject(new Error('Cloudinary upload returned no result'));
                resolve(result);
              },
            )
            .end(file.buffer);
        }),
        new Promise(
          (_, reject) => setTimeout(() => reject(new Error('Cloudinary upload timeout')), 30000), // 30 second timeout
        ),
      ])) as UploadApiResponse;

      // Get file extension
      const fileExtension = this.getFileExtension(file.originalname);

      // Generate checksum
      const checksum = this.generateChecksum(file.buffer);

      // Determine category based on MIME type for file_type field
      const fileType = this.getCategoryByMimeType(file.mimetype);

      // Return file info without creating DB record (file service will handle that)
      return {
        filename: file.originalname,
        mimeType: file.mimetype,
        size: Number(file.size),
        extension: fileExtension,
        file_type: fileType, // Add file_type field
        checksum: checksum,
        visibility: 'public',
        url: result.secure_url,
        provider: 'CLOUDINARY',
        // Store the public ID for deletion
        path: result.public_id,
      };
    } catch (error: any) {
      logger.error(`Error uploading file to Cloudinary: ${error.message}`, error);

      // Handle specific timeout error
      if (
        error.message === 'Cloudinary upload timeout' ||
        error.http_code === 499 ||
        error.name === 'TimeoutError'
      ) {
        throw ApiError.InternalServerError(
          'Failed to upload file to Cloudinary due to timeout. Please try again later.',
          'cloudinary.timeout',
        );
      }

      throw ApiError.InternalServerError('Failed to upload file to Cloudinary.', error.message);
    }
  }

  async getFileStream(
    fileId: string,
  ): Promise<{ stream: NodeJS.ReadableStream; mimeType: string; filename: string }> {
    // The file service should provide the file record to this method
    // For now, we'll throw an error indicating this needs to be called differently
    throw new Error(
      'Cloudinary storage getFileStream needs file record - should be called through file service with proper context',
    );
  }

  async deleteFile(fileId: string): Promise<void> {
    try {
      const result = await cloudinary.uploader.destroy(fileId);

      if (result.result === 'ok' || result.result === 'not found') {
        logger.info(`File deleted from Cloudinary: ${fileId}`);
      } else {
        logger.warn(`Unexpected result when deleting from Cloudinary: ${fileId}`, result);
      }
    } catch (error: any) {
      logger.error(`Error deleting file from Cloudinary: ${error.message}`, error);
      throw ApiError.InternalServerError('Failed to delete file from Cloudinary.', error.message);
    }
  }
}
