import sharp from 'sharp';
import { logger } from '../logger.js';

export interface ImageMetadata {
  width: number;
  height: number;
}

export interface ImageVariant {
  buffer: Buffer;
  width: number;
  height: number;
}

export interface ImageVariants {
  thumb: ImageVariant;
  display: ImageVariant;
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
        thumbSize: thumb.buffer.length,
        displaySize: display.buffer.length,
      });

      return { thumb, display };
    } catch (error) {
      logger.error('Image processing failed', error as Error);
      throw error;
    }
  }

  private async createThumbnail(buffer: Buffer): Promise<ImageVariant> {
    const image = sharp(buffer)
      .rotate()
      .resize(400, 400, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 80 });

    const processedBuffer = await image.toBuffer();
    const metadata = await sharp(processedBuffer).metadata();

    return {
      buffer: processedBuffer,
      width: metadata.width || 0,
      height: metadata.height || 0,
    };
  }

  private async createDisplay(buffer: Buffer): Promise<ImageVariant> {
    const image = sharp(buffer)
      .rotate()
      .resize(1600, 1600, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 80 });

    const processedBuffer = await image.toBuffer();
    const metadata = await sharp(processedBuffer).metadata();

    return {
      buffer: processedBuffer,
      width: metadata.width || 0,
      height: metadata.height || 0,
    };
  }

  isImage(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  isVideo(mimeType: string): boolean {
    return mimeType.startsWith('video/');
  }
}
