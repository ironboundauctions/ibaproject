import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { config } from './config.js';
import { logger } from './logger.js';
import { DatabaseService } from './services/database.js';
import { RaidService } from './services/raid.js';
import { ImageProcessor } from './services/imageProcessor.js';
import { StorageService } from './services/storage.js';
import { JobProcessor } from './services/jobProcessor.js';
import { CleanupProcessor } from './services/cleanupProcessor.js';
import { UploadHandler } from './services/uploadHandler.js';

class MediaPublishingWorker {
  private isShuttingDown = false;
  private db: DatabaseService;
  private storage: StorageService;
  private jobProcessor: JobProcessor;
  private cleanupProcessor: CleanupProcessor;
  private uploadHandler: UploadHandler;
  private activeJobs = 0;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private lastCleanup: Date = new Date(0);
  private httpServer: any;

  constructor() {
    this.db = new DatabaseService();
    const raid = new RaidService();
    const imageProcessor = new ImageProcessor();
    this.storage = new StorageService();

    this.jobProcessor = new JobProcessor(this.db, raid, imageProcessor, this.storage);
    this.cleanupProcessor = new CleanupProcessor(this.db, this.storage);
    this.uploadHandler = new UploadHandler(this.db, imageProcessor, this.storage, raid);
  }

  async start(): Promise<void> {
    logger.info('Starting Media Publishing Worker', {
      pollInterval: config.worker.pollInterval,
      maxRetries: config.worker.maxRetries,
      concurrency: config.worker.concurrency,
    });

    this.setupSignalHandlers();
    this.startHttpServer();
    this.scheduleCleanup();

    while (!this.isShuttingDown) {
      try {
        const promises: Promise<boolean>[] = [];

        for (let i = 0; i < config.worker.concurrency; i++) {
          if (!this.isShuttingDown) {
            promises.push(this.processNextJob());
          }
        }

        const results = await Promise.all(promises);
        const processedCount = results.filter(Boolean).length;

        if (processedCount === 0) {
          await this.sleep(config.worker.pollInterval);
        } else {
          logger.debug(`Processed ${processedCount} jobs`);
        }
      } catch (error) {
        logger.error('Worker loop error', error as Error);
        await this.sleep(5000);
      }
    }

    await this.shutdown();
  }

  private startHttpServer(): void {
    const app = express();
    const upload = multer({ storage: multer.memoryStorage() });

    app.use(express.json());

    app.use((req: Request, res: Response, next: NextFunction) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Client-Info, Apikey');

      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
      }

      next();
    });

    app.get('/health', (req: Request, res: Response) => {
      res.json({
        status: 'ok',
        uptime: process.uptime(),
        activeJobs: this.activeJobs
      });
    });

    app.post('/api/upload-and-process', upload.single('file'), async (req: Request, res: Response) => {
      await this.uploadHandler.handlePCUpload(req, res);
    });

    app.post('/api/bulk-upload', upload.array('files', 1000), async (req: Request, res: Response) => {
      await this.uploadHandler.handleBulkUpload(req, res);
    });

    app.post('/api/bulk-process', async (req: Request, res: Response) => {
      await this.uploadHandler.handleBulkProcess(req, res);
    });

    app.post('/api/irondrive-bulk-upload', async (req: Request, res: Response) => {
      await this.uploadHandler.handleIronDriveBulkUpload(req, res);
    });

    app.post('/api/delete-batch-files', async (req: Request, res: Response) => {
      await this.uploadHandler.handleDeleteBatchFiles(req, res);
    });

    app.get('/api/check-asset-group/:assetGroupId', async (req: Request, res: Response) => {
      try {
        const { assetGroupId } = req.params;

        if (!assetGroupId) {
          res.status(400).json({ error: 'Missing assetGroupId' });
          return;
        }

        const files = await this.storage.listAssetGroupFiles(assetGroupId);
        const dbFiles = await this.db.getFilesByAssetGroup(assetGroupId);

        res.json({
          assetGroupId,
          filesInB2: files,
          filesInDB: dbFiles.map(f => ({ id: f.id, variant: f.variant, detached: !!f.detached_at })),
          b2Count: files.length,
          dbCount: dbFiles.length
        });
      } catch (error) {
        logger.error('Check asset group failed', error as Error);
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Check failed'
        });
      }
    });

    app.post('/api/delete-asset-group', async (req: Request, res: Response) => {
      try {
        const { assetGroupId } = req.body;

        if (!assetGroupId) {
          res.status(400).json({ error: 'Missing assetGroupId' });
          return;
        }

        logger.info('Immediate deletion request received', { assetGroupId });

        const hasActive = await this.db.hasActiveReferences(assetGroupId);
        if (hasActive) {
          res.status(400).json({
            error: 'Cannot delete: asset group has active references (still attached to items)'
          });
          return;
        }

        await this.storage.deleteAssetGroup(assetGroupId);
        logger.info('Asset group deleted from B2', { assetGroupId });

        const filesToDelete = await this.db.getFilesByAssetGroup(assetGroupId);
        const fileIds = filesToDelete.map(f => f.id);

        if (fileIds.length > 0) {
          await this.db.deleteFiles(fileIds);
          logger.info('Database records deleted', { assetGroupId, count: fileIds.length });
        }

        res.json({
          success: true,
          message: `Deleted ${fileIds.length} file(s) from B2 and database`,
          deletedCount: fileIds.length
        });
      } catch (error) {
        logger.error('Delete asset group failed', error as Error);
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Deletion failed'
        });
      }
    });

    app.post('/api/scan-orphaned-b2-files', async (req: Request, res: Response) => {
      try {
        logger.info('B2 orphaned files scan requested - COMPREHENSIVE MODE');
        const startTime = Date.now();

        // Get EVERY file from B2 bucket
        const allB2Files = await this.storage.listAllFiles();
        logger.info('All B2 files found', { totalFiles: allB2Files.length });

        // Get all b2_key values from database
        const dbFileKeys = await this.db.getAllFileKeys();
        logger.info('Database file keys found', { count: dbFileKeys.length });

        // Create a set of database keys for fast lookup
        const dbKeySet = new Set(dbFileKeys);

        // Find orphaned files - ANY file in B2 that doesn't have a matching b2_key in database
        const orphanedFiles = allB2Files.filter(file => !dbKeySet.has(file.key));
        const estimatedWastedSpace = orphanedFiles.reduce((sum, file) => sum + file.size, 0);

        // Also get asset group statistics for reporting
        const b2FilesWithAssetGroups = await this.storage.listAllAssetGroups();
        const b2AssetGroupIds = new Set(b2FilesWithAssetGroups.map(f => f.assetGroupId));
        const dbAssetGroups = await this.db.getAllAssetGroups();

        logger.info('B2 comprehensive scan complete', {
          totalB2Files: allB2Files.length,
          totalDbFileKeys: dbFileKeys.length,
          totalB2AssetGroups: b2AssetGroupIds.size,
          totalDbAssetGroups: dbAssetGroups.length,
          orphanedFiles: orphanedFiles.length,
          wastedSpace: estimatedWastedSpace
        });

        res.json({
          totalB2Files: b2AssetGroupIds.size,
          totalDbAssetGroups: dbAssetGroups.length,
          orphanedFiles: orphanedFiles.map(f => ({
            key: f.key,
            size: f.size,
            lastModified: f.lastModified
          })),
          estimatedWastedSpace,
          scanDuration: Date.now() - startTime
        });
      } catch (error) {
        logger.error('B2 scan failed', error as Error);
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Scan failed'
        });
      }
    });

    app.post('/api/cleanup-orphaned-b2-files', async (req: Request, res: Response) => {
      try {
        const { fileKeys } = req.body;

        if (!Array.isArray(fileKeys) || fileKeys.length === 0) {
          res.status(400).json({ error: 'Missing or invalid fileKeys array' });
          return;
        }

        logger.info('B2 orphaned files cleanup requested - COMPREHENSIVE MODE', { fileCount: fileKeys.length });

        // Group files by asset group ID where possible, otherwise delete individually
        const assetGroupIds = new Set<string>();
        const individualFiles: string[] = [];

        for (const key of fileKeys) {
          const parts = key.split('/');

          // Try to identify asset group pattern
          let foundAssetGroup = false;

          if (parts.length >= 3 && parts[0] === 'assets') {
            const potentialAssetGroupId = parts[2];
            if (potentialAssetGroupId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
              assetGroupIds.add(potentialAssetGroupId);
              foundAssetGroup = true;
            } else {
              // Old format: assets/{assetGroupId}/file
              const oldFormatId = parts[1];
              if (oldFormatId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                assetGroupIds.add(oldFormatId);
                foundAssetGroup = true;
              }
            }
          }

          // If no asset group pattern found, delete individually
          if (!foundAssetGroup) {
            individualFiles.push(key);
          }
        }

        logger.info('Cleanup strategy determined', {
          assetGroupCount: assetGroupIds.size,
          individualFileCount: individualFiles.length
        });

        let deleted = 0;
        let failed = 0;

        // Delete asset group folders
        for (const assetGroupId of assetGroupIds) {
          try {
            const files = await this.storage.listAssetGroupFiles(assetGroupId);
            logger.info('Deleting asset group folder', { assetGroupId, fileCount: files.length });

            await this.storage.deleteAssetGroup(assetGroupId);

            deleted += files.length;
            logger.info('Asset group folder deleted', { assetGroupId, filesDeleted: files.length });
          } catch (error) {
            logger.error('Failed to delete asset group folder', { assetGroupId, error });
            failed++;
          }
        }

        // Delete individual files (like TEST/TEST.TXT)
        for (const fileKey of individualFiles) {
          try {
            logger.info('Deleting individual file', { fileKey });
            await this.storage.deleteFile(fileKey);
            deleted++;
            logger.info('Individual file deleted', { fileKey });
          } catch (error) {
            logger.error('Failed to delete individual file', { fileKey, error });
            failed++;
          }
        }

        logger.info('B2 cleanup complete', {
          assetGroupsDeleted: assetGroupIds.size,
          individualFilesDeleted: individualFiles.length,
          totalDeleted: deleted,
          totalFailed: failed
        });

        res.json({
          deleted,
          failed,
          assetGroupsDeleted: assetGroupIds.size,
          individualFilesDeleted: individualFiles.length
        });
      } catch (error) {
        logger.error('B2 cleanup failed', error as Error);
        res.status(500).json({
          error: error instanceof Error ? error.message : 'Cleanup failed'
        });
      }
    });

    const port = process.env.PORT || 3000;
    this.httpServer = app.listen(port, () => {
      logger.info(`HTTP server listening on port ${port}`);
    });
  }

  private scheduleCleanup(): void {
    // TESTING MODE: Run cleanup every 2 minutes (was 24 hours)
    const CLEANUP_INTERVAL = 2 * 60 * 1000;

    this.cleanupTimer = setInterval(async () => {
      if (!this.isShuttingDown) {
        try {
          logger.info('Running scheduled cleanup');
          await this.cleanupProcessor.processCleanup();

          // Also cleanup expired batch jobs
          logger.info('Running expired batch cleanup');
          await this.cleanupProcessor.cleanupExpiredBatches();

          this.lastCleanup = new Date();
        } catch (error) {
          logger.error('Cleanup failed', error as Error);
        }
      }
    }, CLEANUP_INTERVAL);

    // TESTING MODE: Run initial cleanup after 10 seconds (was 60 seconds)
    setTimeout(async () => {
      try {
        logger.info('Running initial cleanup');
        await this.cleanupProcessor.processCleanup();
        this.lastCleanup = new Date();
      } catch (error) {
        logger.error('Initial cleanup failed', error as Error);
      }
    }, 10000);
  }

  private async processNextJob(): Promise<boolean> {
    if (this.isShuttingDown) {
      return false;
    }

    this.activeJobs++;
    try {
      return await this.jobProcessor.processJob();
    } finally {
      this.activeJobs--;
    }
  }

  private setupSignalHandlers(): void {
    process.on('SIGTERM', () => {
      logger.info('Received SIGTERM signal');
      this.isShuttingDown = true;
    });

    process.on('SIGINT', () => {
      logger.info('Received SIGINT signal');
      this.isShuttingDown = true;
    });

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', error);
      this.isShuttingDown = true;
    });

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection', reason as Error);
    });
  }

  private async shutdown(): Promise<void> {
    logger.info('Shutting down gracefully...');

    if (this.httpServer) {
      this.httpServer.close();
      logger.info('HTTP server closed');
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    while (this.activeJobs > 0) {
      logger.info(`Waiting for ${this.activeJobs} active jobs to complete`);
      await this.sleep(1000);
    }

    await this.db.close();
    logger.info('Worker shutdown complete');
    process.exit(0);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

const worker = new MediaPublishingWorker();
worker.start().catch((error) => {
  logger.error('Worker failed to start', error);
  process.exit(1);
});
