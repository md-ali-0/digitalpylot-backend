export interface IStorageService {
  uploadFile(file: Express.Multer.File): Promise<any>;
  getFileStream(
    fileId: string,
  ): Promise<{ stream: NodeJS.ReadableStream; mimeType: string; filename: string }>;
  deleteFile(fileId: string): Promise<void>;
}
