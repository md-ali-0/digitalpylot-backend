/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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

export class S3StorageService implements IStorageService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    if (
      !env.AWS_ACCESS_KEY_ID ||
      !env.AWS_SECRET_ACCESS_KEY ||
      !env.AWS_REGION ||
      !env.AWS_S3_BUCKET_NAME
    ) {
      logger.error('AWS S3 environment variables are not fully configured.');
      throw ApiError.InternalServerError('AWS S3 configuration missing.');
    }

    this.s3Client = new S3Client({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      },
    });
    this.bucketName = env.AWS_S3_BUCKET_NAME;
    logger.info(`S3 Storage Service initialized for bucket: ${this.bucketName}`);
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

  async uploadFile(file: Express.Multer.File): Promise<any> {
    const fileKey = `${Date.now()}-${file.originalname}`; // Unique key for S3
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: fileKey,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    try {
      await this.s3Client.send(command);
      const fileUrl = `https://${this.bucketName}.s3.${env.AWS_REGION}.amazonaws.com/${fileKey}`;

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
        size: BigInt(file.size),
        extension: fileExtension,
        file_type: fileType,
        checksum: checksum,
        visibility: 'public',
        path: fileKey, // Store S3 key
        url: fileUrl, // Public URL
        provider: 'S3',
      };
    } catch (error: any) {
      logger.error(`Error uploading file to S3: ${error.message}`, error);
      throw ApiError.InternalServerError('Failed to upload file to S3.', error.message);
    }
  }

  async getFileStream(
    fileId: string,
  ): Promise<{ stream: NodeJS.ReadableStream; mimeType: string; filename: string }> {
    const fileRecord = await prisma.file.findUnique({ where: { id: fileId } });

    if (!fileRecord || fileRecord.provider !== 'S3') {
      throw ApiError.NotFound('File not found or not stored in S3.');
    }

    if (!fileRecord.path) {
      throw ApiError.NotFound('File path is missing for the requested file.');
    }
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: fileRecord.path, // S3 key is stored in 'path'
    });

    try {
      const { Body, ContentType } = await this.s3Client.send(command);
      if (!Body) {
        throw ApiError.NotFound('File content not found in S3.');
      }
      return {
        stream: Body as NodeJS.ReadableStream,
        mimeType: ContentType || fileRecord.mimeType,
        filename: fileRecord.filename,
      };
    } catch (error: any) {
      logger.error(`Error getting file from S3: ${error.message}`, error);
      if (error.name === 'NoSuchKey') {
        throw ApiError.NotFound('File not found in S3 bucket.');
      }
      throw ApiError.InternalServerError('Failed to retrieve file from S3.', error.message);
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    const fileRecord = await prisma.file.findUnique({ where: { id: fileId } });

    if (!fileRecord || fileRecord.provider !== 'S3') {
      throw ApiError.NotFound('File not found or not stored in S3.');
    }

    if (!fileRecord.path) {
      throw ApiError.NotFound('File path is missing for the requested file.');
    }

    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: fileRecord.path, // S3 key is stored in 'path'
    });

    try {
      await this.s3Client.send(command);
      logger.info(`File deleted from S3: ${fileRecord.filename} (ID: ${fileRecord.id})`);
    } catch (error: any) {
      logger.error(`Error deleting file from S3: ${error.message}`, error);
      throw ApiError.InternalServerError('Failed to delete file from S3.', error.message);
    }
  }

  async getSignedUrl(fileId: string, expiresIn = 3600): Promise<string> {
    const fileRecord = await prisma.file.findUnique({ where: { id: fileId } });

    if (!fileRecord || fileRecord.provider !== 'S3') {
      throw ApiError.NotFound('File not found or not stored in S3.');
    }

    if (!fileRecord.path) {
      throw ApiError.NotFound('File path is missing for the requested file.');
    }

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: fileRecord.path,
    });

    try {
      const signedUrl = await getSignedUrl(this.s3Client, command, { expiresIn });
      return signedUrl;
    } catch (error: any) {
      logger.error(`Error generating signed URL for file ${fileId}: ${error.message}`, error);
      throw ApiError.InternalServerError('Failed to generate signed URL.', error.message);
    }
  }
}
