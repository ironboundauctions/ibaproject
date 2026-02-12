import { S3Client, PutObjectCommand, DeleteObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { config } from '../config.js';
import { logger } from '../logger.js';

export class StorageService {
  private s3Client: S3Client;

  constructor() {
    this.s3Client = new S3Client({
      region: config.b2.region,
      endpoint: `https://${config.b2.endpoint}`,
      credentials: {
        accessKeyId: config.b2.keyId,
        secretAccessKey: config.b2.appKey,
      },
    });
  }

  async uploadFile(key: string, data: Buffer, contentType: string): Promise<string> {
    logger.debug('Uploading file to B2', { key, size: data.length, contentType });

    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: config.b2.bucket,
          Key: key,
          Body: data,
          ContentType: contentType,
          CacheControl: 'public, max-age=31536000, immutable',
        })
      );

      const url = `${config.cdn.baseUrl}/file/IBA-Lot-Media/${key}`;
      logger.info('File uploaded successfully', { key, url });

      return url;
    } catch (error) {
      logger.error('File upload failed', error as Error);
      throw error;
    }
  }

  async uploadVariants(
    assetGroupId: string,
    thumbBuffer: Buffer,
    displayBuffer: Buffer
  ): Promise<{ thumbUrl: string; displayUrl: string }> {
    const thumbKey = `assets/${assetGroupId}/thumb.webp`;
    const displayKey = `assets/${assetGroupId}/display.webp`;

    const [thumbUrl, displayUrl] = await Promise.all([
      this.uploadFile(thumbKey, thumbBuffer, 'image/webp'),
      this.uploadFile(displayKey, displayBuffer, 'image/webp'),
    ]);

    return { thumbUrl, displayUrl };
  }

  async deleteFile(key: string): Promise<void> {
    logger.debug('Deleting file from B2', { key });

    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: config.b2.bucket,
          Key: key,
        })
      );

      logger.info('File deleted successfully', { key });
    } catch (error) {
      logger.error('File deletion failed', { key, error: error as Error });
      throw error;
    }
  }

  async deleteAssetGroup(assetGroupId: string): Promise<void> {
    logger.info('Deleting asset group from B2', { assetGroupId });

    const keys = [
      `assets/${assetGroupId}/thumb.webp`,
      `assets/${assetGroupId}/display.webp`,
    ];

    try {
      await this.s3Client.send(
        new DeleteObjectsCommand({
          Bucket: config.b2.bucket,
          Delete: {
            Objects: keys.map(Key => ({ Key })),
            Quiet: true,
          },
        })
      );

      logger.info('Asset group deleted successfully', { assetGroupId, keys });
    } catch (error) {
      logger.error('Asset group deletion failed', { assetGroupId, error: error as Error });
      throw error;
    }
  }

  generateCdnKeyPrefix(assetGroupId: string): string {
    return `assets/${assetGroupId}`;
  }
}
