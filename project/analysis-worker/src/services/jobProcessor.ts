import { config } from '../config.js';
import { logger } from '../logger.js';
import { DatabaseService } from './database.js';
import { IronDriveService } from './irondrive.js';
import type { BatchAnalysisJob, AnalysisResult, IronDriveAnalysisRequest } from '../types.js';

export class JobProcessor {
  private db: DatabaseService;
  private irondrive: IronDriveService;
  private activeJobs: Set<string> = new Set();

  constructor() {
    this.db = new DatabaseService();
    this.irondrive = new IronDriveService();
  }

  async processJobs(): Promise<void> {
    try {
      const availableSlots = config.server.maxConcurrentJobs - this.activeJobs.size;

      if (availableSlots <= 0) {
        logger.debug('All job slots occupied', {
          active: this.activeJobs.size,
          max: config.server.maxConcurrentJobs,
        });
        return;
      }

      const pendingJobs = await this.db.getPendingJobs(availableSlots);

      if (pendingJobs.length === 0) {
        logger.debug('No pending jobs found');
        return;
      }

      logger.info('Processing pending jobs', { count: pendingJobs.length });

      for (const job of pendingJobs) {
        if (this.activeJobs.has(job.id)) {
          continue;
        }

        this.activeJobs.add(job.id);
        this.processJob(job).finally(() => {
          this.activeJobs.delete(job.id);
        });
      }
    } catch (error) {
      logger.error('Error in processJobs', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async processJob(job: BatchAnalysisJob): Promise<void> {
    logger.info('Starting job processing', {
      jobId: job.id,
      totalFiles: job.total_files,
    });

    try {
      await this.db.updateJobStatus(job.id, 'analyzing');

      const results: AnalysisResult[] = [...job.results];
      const batchSize = config.server.batchSize;

      for (let i = job.processed_files; i < job.total_files; i += batchSize) {
        const end = Math.min(i + batchSize, job.total_files);
        const batch = results.slice(i, end);

        const requests: IronDriveAnalysisRequest[] = batch
          .filter(r => !r.error && !r.analysis)
          .map(r => ({
            imageUrl: `temp://${r.fileName}`,
            fileName: r.fileName,
          }));

        if (requests.length === 0) {
          continue;
        }

        const analyses = await this.irondrive.analyzeBatch(requests);

        let analysisIndex = 0;
        for (let j = 0; j < batch.length; j++) {
          if (!batch[j].error && !batch[j].analysis) {
            if (analysisIndex < analyses.length) {
              results[i + j].analysis = analyses[analysisIndex];
              analysisIndex++;
            } else {
              results[i + j].error = 'Analysis failed - no response from IronDrive';
            }
          }
        }

        await this.db.updateJobProgress(job.id, end, results);

        logger.info('Batch processed', {
          jobId: job.id,
          progress: `${end}/${job.total_files}`,
        });
      }

      await this.db.updateJobStatus(job.id, 'completed', {
        processed_files: job.total_files,
        results,
      });

      logger.info('Job completed successfully', {
        jobId: job.id,
        totalFiles: job.total_files,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Job processing failed', {
        jobId: job.id,
        error: errorMessage,
      });

      await this.db.setJobError(job.id, errorMessage);
    }
  }

  getActiveJobCount(): number {
    return this.activeJobs.size;
  }
}
