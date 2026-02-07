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

      if (!this.imageProcessor.isImage(file.file_type)) {
        logger.info('Skipping non-image file (direct copy)', {
          fileId: file.id,
          fileType: file.file_type,
        });
        throw new Error('Video processing not yet implemented');
      }

      const sourceBuffer = await this.raid.downloadFile(file.file_key);

      const variants = await this.imageProcessor.processImage(sourceBuffer);

      const cdnKeyPrefix = this.storage.generateCdnKeyPrefix(file.asset_group_id);

      const { thumbUrl, displayUrl } = await this.storage.uploadVariants(
        file.asset_group_id,
        variants.thumb,
        variants.display
      );

      await this.db.markJobCompleted(
        job.id,
        job.file_id,
        cdnKeyPrefix,
        thumbUrl,
        displayUrl
      );

      logger.info('Job completed successfully', {
        jobId: job.id,
        fileId: job.file_id,
        thumbUrl,
        displayUrl,
      });

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Job processing failed', { jobId: job.id, error: errorMessage });

      await this.db.markJobFailed(job.id, job.file_id, errorMessage);

      return true;
    }
  }
}
