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

      const url = `${config.cdn.baseUrl}/${key}`;
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
  ): Promise<{ thumbUrl: string; thumbB2Key: string; displayUrl: string; displayB2Key: string }> {
    const thumbKey = `assets/${assetGroupId}/thumb.webp`;
    const displayKey = `assets/${assetGroupId}/display.webp`;

    const [thumbUrl, displayUrl] = await Promise.all([
      this.uploadFile(thumbKey, thumbBuffer, 'image/webp'),
      this.uploadFile(displayKey, displayBuffer, 'image/webp'),
    ]);

    return {
      thumbUrl,
      thumbB2Key: thumbKey,
      displayUrl,
      displayB2Key: displayKey,
    };
  }

  async uploadVideo(
    assetGroupId: string,
    videoBuffer: Buffer,
    mimeType: string
  ): Promise<{ videoUrl: string; videoB2Key: string }> {
    const extension = this.getVideoExtension(mimeType);
    const videoKey = `assets/${assetGroupId}/video${extension}`;

    const videoUrl = await this.uploadFile(videoKey, videoBuffer, mimeType);

    return {
      videoUrl,
      videoB2Key: videoKey,
    };
  }

  private getVideoExtension(mimeType: string): string {
    const mimeToExt: Record<string, string> = {
      'video/mp4': '.mp4',
      'video/quicktime': '.mov',
      'video/webm': '.webm',
      'video/x-msvideo': '.avi',
      'video/x-matroska': '.mkv',
    };

    return mimeToExt[mimeType] || '.mp4';
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

  async deleteAssetGroup(assetGroupId: string, variants: string[] = ['thumb', 'display', 'video']): Promise<void> {
    logger.info('Deleting asset group from B2', { assetGroupId, variants });

    const keys: string[] = [];

    for (const variant of variants) {
      if (variant === 'thumb' || variant === 'display') {
        keys.push(`assets/${assetGroupId}/${variant}.webp`);
      } else if (variant === 'video') {
        const videoExtensions = ['.mp4', '.mov', '.webm', '.avi', '.mkv'];
        for (const ext of videoExtensions) {
          keys.push(`assets/${assetGroupId}/video${ext}`);
        }
      }
    }

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

      logger.info('Asset group deleted successfully', { assetGroupId, keysAttempted: keys.length });
    } catch (error) {
      logger.error('Asset group deletion failed', { assetGroupId, error: error as Error });
      throw error;
    }
  }

  generateCdnKeyPrefix(assetGroupId: string): string {
    return `assets/${assetGroupId}`;
  }

  getCdnUrl(key: string): string {
    return `${config.cdn.baseUrl}/${key}`;
  }
}
