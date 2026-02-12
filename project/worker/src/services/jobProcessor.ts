import { DatabaseService } from './database.js';
import { RaidService } from './raid.js';
import { ImageProcessor } from './imageProcessor.js';
import { StorageService } from './storage.js';
import { logger } from '../logger.js';

export class JobProcessor {
  constructor(
    private db: DatabaseService,
    private raid: RaidService,
    private imageProcessor: ImageProcessor,
    private storage: StorageService
  ) {}

  async processJob(): Promise<boolean> {
    const job = await this.db.getNextJob();

    if (!job) {
      return false;
    }

    logger.info('Processing job', { jobId: job.id, fileId: job.file_id });

    try {
      const file = await this.db.getFileById(job.file_id);

      if (!file) {
        throw new Error(`File not found: ${job.file_id}`);
      }

      logger.debug('File details', {
        fileId: file.id,
        fileKey: file.file_key,
        fileName: file.file_name,
        fileType: file.file_type,
      });

      const sourceBuffer = await this.raid.downloadFile(file.file_key);

      if (this.imageProcessor.isImage(file.file_type)) {
        await this.processImage(job, file, sourceBuffer);
      } else if (this.imageProcessor.isVideo(file.file_type)) {
        await this.processVideo(job, file, sourceBuffer);
      } else {
        throw new Error(`Unsupported file type: ${file.file_type}`);
      }

      logger.info('Job completed successfully', {
        jobId: job.id,
        fileId: job.file_id,
      });

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Job processing failed', { jobId: job.id, error: errorMessage });

      await this.db.markJobFailed(job.id, job.file_id, errorMessage);

      return true;
    }
  }

  private async processImage(job: any, file: any, sourceBuffer: Buffer): Promise<void> {
    logger.info('Processing image', { fileId: file.id });

    const variants = await this.imageProcessor.processImage(sourceBuffer);

    const cdnKeyPrefix = this.storage.generateCdnKeyPrefix(file.asset_group_id);

    const { thumbUrl, displayUrl } = await this.storage.uploadVariants(
      file.asset_group_id,
      variants.thumb.buffer,
      variants.display.buffer
    );

    await this.db.upsertVariant(file.asset_group_id, 'thumb', thumbUrl, {
      width: variants.thumb.width,
      height: variants.thumb.height,
    });

    await this.db.upsertVariant(file.asset_group_id, 'display', displayUrl, {
      width: variants.display.width,
      height: variants.display.height,
    });

    await this.db.markJobCompleted(
      job.id,
      job.file_id,
      cdnKeyPrefix,
      thumbUrl,
      displayUrl
    );

    logger.info('Image processed successfully', {
      fileId: file.id,
      thumbUrl,
      displayUrl,
    });
  }

  private async processVideo(job: any, file: any, sourceBuffer: Buffer): Promise<void> {
    logger.info('Processing video', { fileId: file.id, mimeType: file.file_type });

    const videoUrl = await this.storage.uploadVideo(
      file.asset_group_id,
      sourceBuffer,
      file.file_type
    );

    await this.db.upsertVariant(file.asset_group_id, 'video', videoUrl, {});

    const cdnKeyPrefix = this.storage.generateCdnKeyPrefix(file.asset_group_id);

    await this.db.markJobCompleted(
      job.id,
      job.file_id,
      cdnKeyPrefix,
      '',
      videoUrl
    );

    logger.info('Video processed successfully', {
      fileId: file.id,
      videoUrl,
    });
  }
}
