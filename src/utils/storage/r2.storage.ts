/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import env from '@config/env';
import logger from '@config/winston';
import { ApiError } from '@core/error.classes';
import crypto from 'crypto';
import path from 'path';
import prisma from '../../config/db';
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

export class R2StorageService implements IStorageService {
  private s3Client: S3Client;
  private bucketName: string;
  private publicUrl: string;

  constructor() {
    if (
      !env.R2_ACCESS_KEY_ID ||
      !env.R2_SECRET_ACCESS_KEY ||
      !env.R2_BUCKET_NAME ||
      !env.R2_ENDPOINT
    ) {
      logger.error('Cloudflare R2 environment variables are not fully configured.');
      throw ApiError.InternalServerError('Cloudflare R2 configuration missing.');
    }

    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: env.R2_ENDPOINT,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    });
    this.bucketName = env.R2_BUCKET_NAME;
    this.publicUrl = env.R2_PUBLIC_URL || '';
    logger.info(`Cloudflare R2 Storage Service initialized for bucket: ${this.bucketName}`);
  }

  private getCategoryByMimeType(mimeType: string): string {
    for (const [category, mimeTypes] of Object.entries(FILE_TYPE_CATEGORIES)) {
      if (mimeTypes.includes(mimeType)) {
        return category;
      }
    }
    return 'other';
  }

  private getFileExtension(filename: string): string {
    return path.extname(filename).toLowerCase();
  }

  private generateChecksum(buffer: Buffer): string {
    return crypto.createHash('md5').update(buffer).digest('hex');
  }

  async uploadFile(file: Express.Multer.File): Promise<any> {
    const fileKey = `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`;
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    try {
      await this.s3Client.send(command);

      // Use public URL if provided, else construct from endpoint (though R2 construct is complex)
      let fileUrl = `${this.publicUrl}/${fileKey}`;
      if (!this.publicUrl) {
        // Fallback if public URL is not defined
        fileUrl = `${env.R2_ENDPOINT}/${this.bucketName}/${fileKey}`;
      }

      const fileExtension = this.getFileExtension(file.originalname);
      const checksum = this.generateChecksum(file.buffer);
      const fileType = this.getCategoryByMimeType(file.mimetype);

      return {
        filename: file.originalname,
        mimeType: file.mimetype,
        size: BigInt(file.size),
        extension: fileExtension,
        file_type: fileType,
        checksum: checksum,
        visibility: 'public',
        path: fileKey,
        url: fileUrl,
        provider: 'R2',
      };
    } catch (error: any) {
      logger.error(`Error uploading file to R2: ${error.message}`, error);
      throw ApiError.InternalServerError('Failed to upload file to R2.', error.message);
    }
  }

  async getFileStream(
    fileId: string,
  ): Promise<{ stream: NodeJS.ReadableStream; mimeType: string; filename: string }> {
    const fileRecord = await prisma.file.findUnique({ where: { id: fileId } });

    if (!fileRecord || fileRecord.provider !== 'R2') {
      throw ApiError.NotFound('File not found or not stored in R2.');
    }

    if (!fileRecord.path) {
      throw ApiError.NotFound('File path is missing for the requested file.');
    }

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: fileRecord.path,
    });

    try {
      const { Body, ContentType } = await this.s3Client.send(command);
      if (!Body) {
        throw ApiError.NotFound('File content not found in R2.');
      }
      return {
        stream: Body as NodeJS.ReadableStream,
        mimeType: ContentType || fileRecord.mimeType,
        filename: fileRecord.filename,
      };
    } catch (error: any) {
      logger.error(`Error getting file from R2: ${error.message}`, error);
      if (error.name === 'NoSuchKey') {
        throw ApiError.NotFound('File not found in R2 bucket.');
      }
      throw ApiError.InternalServerError('Failed to retrieve file from R2.', error.message);
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    const fileRecord = await prisma.file.findUnique({ where: { id: fileId } });

    if (!fileRecord || fileRecord.provider !== 'R2') {
      throw ApiError.NotFound('File not found or not stored in R2.');
    }

    if (!fileRecord.path) {
      throw ApiError.NotFound('File path is missing for the requested file.');
    }

    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: fileRecord.path,
    });

    try {
      await this.s3Client.send(command);
      logger.info(`File deleted from R2: ${fileRecord.filename} (ID: ${fileRecord.id})`);
    } catch (error: any) {
      logger.error(`Error deleting file from R2: ${error.message}`, error);
      throw ApiError.InternalServerError('Failed to delete file from R2.', error.message);
    }
  }
}
