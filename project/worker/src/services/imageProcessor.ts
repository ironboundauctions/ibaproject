import sharp from 'sharp';
import { logger } from '../logger.js';

export interface ImageVariants {
  thumb: Buffer;
  display: Buffer;
}

export class ImageProcessor {
  async processImage(sourceBuffer: Buffer): Promise<ImageVariants> {
    logger.debug('Processing image', { size: sourceBuffer.length });

    try {
      const image = sharp(sourceBuffer);
      const metadata = await image.metadata();

      logger.debug('Image metadata', {
        format: metadata.format,
        width: metadata.width,
        height: metadata.height,
      });

      const [thumb, display] = await Promise.all([
        this.createThumbnail(sourceBuffer),
        this.createDisplay(sourceBuffer),
      ]);

      logger.info('Image processed successfully', {
        thumbSize: thumb.length,
        displaySize: display.length,
      });

      return { thumb, display };
    } catch (error) {
      logger.error('Image processing failed', error as Error);
      throw error;
    }
  }

  private async createThumbnail(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer)
      .resize(400, 400, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();
  }

  private async createDisplay(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer)
      .resize(1600, 1600, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 90 })
      .toBuffer();
  }

  isImage(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }
}
