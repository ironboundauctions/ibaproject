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

  async cleanupExpiredBatches(): Promise<number> {
    logger.info('Starting expired batch cleanup');

    const expiredBatches = await this.db.getExpiredBatchJobs();

    if (expiredBatches.length === 0) {
      logger.info('No expired batches to clean up');
      return 0;
    }

    logger.info('Found expired batches', { count: expiredBatches.length });

    let successCount = 0;

    for (const batch of expiredBatches) {
      try {
        // Delete all files from this batch
        const assetGroupIds = this.extractAssetGroupIds(batch.uploaded_files);

        for (const assetGroupId of assetGroupIds) {
          try {
            await this.storage.deleteAssetGroup(assetGroupId);
            logger.info('Deleted expired batch files from B2', { assetGroupId, batchId: batch.id });
          } catch (error) {
            logger.error('Failed to delete batch files from B2', {
              assetGroupId,
              batchId: batch.id,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }

          // Delete database records
          const files = await this.db.getFilesByAssetGroup(assetGroupId);
          const fileIds = files.map(f => f.id);

          if (fileIds.length > 0) {
            try {
              await this.db.deleteFiles(fileIds);
              logger.info('Deleted expired batch file records', {
                assetGroupId,
                batchId: batch.id,
                count: fileIds.length,
              });
            } catch (error) {
              logger.error('Failed to delete batch file records', {
                assetGroupId,
                batchId: batch.id,
                error: error instanceof Error ? error.message : 'Unknown error',
              });
            }
          }
        }

        // Mark batch as expired
        await this.db.markBatchExpired(batch.id);
        successCount++;

        logger.info('Marked batch as expired', { batchId: batch.id });
      } catch (error) {
        logger.error('Failed to cleanup expired batch', {
          batchId: batch.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logger.info('Expired batch cleanup completed', {
      total: expiredBatches.length,
      success: successCount,
      failed: expiredBatches.length - successCount,
    });

    return successCount;
  }

  private extractAssetGroupIds(uploadedFiles: any): string[] {
    try {
      const files = typeof uploadedFiles === 'string' ? JSON.parse(uploadedFiles) : uploadedFiles;
      if (Array.isArray(files)) {
        return files.map((f: any) => f.assetGroupId).filter(Boolean);
      }
      return [];
    } catch (error) {
      logger.error('Failed to extract asset group IDs', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  private async cleanupFile(file: AuctionFile): Promise<void> {
    logger.info('Cleaning up file', {
      fileId: file.id,
      assetGroupId: file.asset_group_id
    });

    const hasActive = await this.db.hasActiveReferences(file.asset_group_id);

    if (hasActive) {
      logger.info('Skipping cleanup - asset group has active references', {
        fileId: file.id,
        assetGroupId: file.asset_group_id
      });
      return;
    }

    let b2DeletionSuccess = false;
    let dbDeletionSuccess = false;
    let errorMessage: string | null = null;

    try {
      await this.storage.deleteAssetGroup(file.asset_group_id, file.item_id || undefined);
      b2DeletionSuccess = true;
      logger.info('B2 files deleted', { assetGroupId: file.asset_group_id, itemId: file.item_id });
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
