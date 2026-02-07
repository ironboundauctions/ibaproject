import { DatabaseService, AuctionFile } from './database.js';
import { StorageService } from './storage.js';
import { logger } from '../logger.js';

export class CleanupProcessor {
  constructor(
    private db: DatabaseService,
    private storage: StorageService
  ) {}

  async processCleanup(): Promise<number> {
    logger.info('Starting cleanup process');

    const filesToClean = await this.db.getFilesForCleanup();

    if (filesToClean.length === 0) {
      logger.info('No files to clean up');
      return 0;
    }

    logger.info('Found files to clean', { count: filesToClean.length });

    let successCount = 0;

    for (const file of filesToClean) {
      try {
        await this.cleanupFile(file);
        successCount++;
      } catch (error) {
        logger.error('Failed to cleanup file', {
          fileId: file.id,
          assetGroupId: file.asset_group_id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    logger.info('Cleanup process completed', {
      total: filesToClean.length,
      success: successCount,
      failed: filesToClean.length - successCount
    });

    return successCount;
  }

  private async cleanupFile(file: AuctionFile): Promise<void> {
    logger.info('Cleaning up file', {
      fileId: file.id,
      assetGroupId: file.asset_group_id
    });

    let b2DeletionSuccess = false;
    let dbDeletionSuccess = false;
    let errorMessage: string | null = null;

    try {
      await this.storage.deleteAssetGroup(file.asset_group_id);
      b2DeletionSuccess = true;
      logger.info('B2 files deleted', { assetGroupId: file.asset_group_id });
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : 'Unknown B2 deletion error';
      logger.error('B2 deletion failed', {
        assetGroupId: file.asset_group_id,
        error: errorMessage
      });
    }

    if (b2DeletionSuccess) {
      try {
        await this.db.deleteFiles([file.id]);
        dbDeletionSuccess = true;
        logger.info('Database record deleted', { fileId: file.id });
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : 'Unknown DB deletion error';
        logger.error('Database deletion failed', {
          fileId: file.id,
          error: errorMessage
        });
      }
    } else {
      logger.warn('Skipping database deletion due to B2 deletion failure', {
        fileId: file.id
      });
    }

    if (!b2DeletionSuccess || !dbDeletionSuccess) {
      throw new Error(errorMessage || 'Cleanup failed');
    }
  }
}
