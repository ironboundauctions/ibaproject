import express from 'express';
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
    this.uploadHandler = new UploadHandler(this.db, imageProcessor, this.storage);
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

    app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        uptime: process.uptime(),
        activeJobs: this.activeJobs
      });
    });

    app.post('/api/upload-and-process', upload.single('file'), async (req, res) => {
      await this.uploadHandler.handlePCUpload(req, res);
    });

    const port = process.env.PORT || 3000;
    this.httpServer = app.listen(port, () => {
      logger.info(`HTTP server listening on port ${port}`);
    });
  }

  private scheduleCleanup(): void {
    const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000;

    this.cleanupTimer = setInterval(async () => {
      if (!this.isShuttingDown) {
        try {
          logger.info('Running scheduled cleanup');
          await this.cleanupProcessor.processCleanup();
          this.lastCleanup = new Date();
        } catch (error) {
          logger.error('Cleanup failed', error as Error);
        }
      }
    }, CLEANUP_INTERVAL);

    setTimeout(async () => {
      try {
        logger.info('Running initial cleanup');
        await this.cleanupProcessor.processCleanup();
        this.lastCleanup = new Date();
      } catch (error) {
        logger.error('Initial cleanup failed', error as Error);
      }
    }, 60000);
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
