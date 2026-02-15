import pg from 'pg';
import { config } from '../config.js';
import { logger } from '../logger.js';

const { Pool } = pg;

export interface PublishJob {
  id: string;
  file_id: string;
  asset_group_id: string | null;
  source_item_id: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority: number;
  retry_count: number;
  max_retries: number;
  error_message: string | null;
  run_after: Date;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface AuctionFile {
  id: string;
  item_id: string | null;
  asset_group_id: string;
  variant: 'source' | 'thumb' | 'display' | 'video';
  source_key: string | null;
  b2_key: string | null;
  cdn_url: string | null;
  original_name: string;
  bytes: number | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  published_status: 'pending' | 'processing' | 'published' | 'failed';
  detached_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export class DatabaseService {
  private pool: pg.Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: config.database.url,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    this.pool.on('error', (err) => {
      logger.error('Unexpected database error', err);
    });
  }

  async getNextJob(): Promise<PublishJob | null> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query<PublishJob>(
        `UPDATE publish_jobs
         SET status = 'processing',
             started_at = NOW(),
             updated_at = NOW()
         WHERE id = (
           SELECT id
           FROM publish_jobs
           WHERE status IN ('pending', 'failed')
             AND retry_count < max_retries
             AND run_after <= NOW()
           ORDER BY priority DESC, run_after ASC, created_at ASC
           FOR UPDATE SKIP LOCKED
           LIMIT 1
         )
         RETURNING *`
      );

      await client.query('COMMIT');

      return result.rows[0] || null;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getFileById(fileId: string): Promise<AuctionFile | null> {
    const result = await this.pool.query<AuctionFile>(
      'SELECT * FROM auction_files WHERE id = $1',
      [fileId]
    );
    return result.rows[0] || null;
  }

  async markJobCompleted(
    jobId: string,
    fileId: string,
    cdnKeyPrefix: string,
    thumbUrl: string,
    displayUrl: string
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE publish_jobs
         SET status = 'completed',
             completed_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [jobId]
      );

      await client.query(
        `UPDATE auction_files
         SET published_status = 'published',
             updated_at = NOW()
         WHERE id = $1 AND variant = 'source'`,
        [fileId]
      );

      await client.query('COMMIT');
      logger.info('Job completed successfully', { jobId, fileId });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async upsertVariant(
    assetGroupId: string,
    variant: string,
    cdnUrl: string,
    metadata: {
      width?: number;
      height?: number;
      durationSeconds?: number;
      b2Key?: string;
    }
  ): Promise<string> {
    const result = await this.pool.query<{ id: string }>(
      `INSERT INTO auction_files (
        asset_group_id,
        variant,
        cdn_url,
        b2_key,
        width,
        height,
        duration_seconds,
        original_name,
        published_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, '', 'published')
      ON CONFLICT (asset_group_id, variant)
      DO UPDATE SET
        cdn_url = EXCLUDED.cdn_url,
        b2_key = EXCLUDED.b2_key,
        width = EXCLUDED.width,
        height = EXCLUDED.height,
        duration_seconds = EXCLUDED.duration_seconds,
        published_status = 'published',
        updated_at = NOW()
      RETURNING id`,
      [
        assetGroupId,
        variant,
        cdnUrl,
        metadata.b2Key || null,
        metadata.width || null,
        metadata.height || null,
        metadata.durationSeconds || null,
      ]
    );

    return result.rows[0].id;
  }

  async markJobFailed(jobId: string, fileId: string, errorMessage: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query<{ retry_count: number; max_retries: number }>(
        `SELECT retry_count, max_retries FROM publish_jobs WHERE id = $1`,
        [jobId]
      );

      const job = result.rows[0];
      const newRetryCount = job.retry_count + 1;
      const willRetry = newRetryCount < job.max_retries;

      const backoffSeconds = willRetry ? Math.pow(2, newRetryCount) * 60 : 0;

      await client.query(
        `UPDATE publish_jobs
         SET status = $1,
             retry_count = retry_count + 1,
             error_message = $2,
             run_after = NOW() + INTERVAL '${backoffSeconds} seconds',
             completed_at = CASE WHEN $1 = 'failed' THEN NOW() ELSE completed_at END,
             updated_at = NOW()
         WHERE id = $3`,
        [willRetry ? 'pending' : 'failed', errorMessage, jobId]
      );

      await client.query(
        `UPDATE auction_files
         SET published_status = $1
         WHERE id = $2 AND variant = 'source'`,
        [willRetry ? 'pending' : 'failed', fileId]
      );

      await client.query('COMMIT');
      logger.warn('Job failed', {
        jobId,
        fileId,
        retryCount: newRetryCount,
        willRetry,
        backoffSeconds
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getFilesForCleanup(): Promise<AuctionFile[]> {
    const result = await this.pool.query<AuctionFile>(
      `SELECT * FROM auction_files
       WHERE detached_at IS NOT NULL
         AND detached_at < NOW() - INTERVAL '30 days'
       ORDER BY detached_at ASC
       LIMIT 100`
    );
    return result.rows;
  }

  async hasActiveReferences(assetGroupId: string): Promise<boolean> {
    const result = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) as count
       FROM auction_files
       WHERE asset_group_id = $1
         AND detached_at IS NULL`,
      [assetGroupId]
    );

    const count = parseInt(result.rows[0]?.count || '0', 10);
    return count > 0;
  }

  async deleteFiles(fileIds: string[]): Promise<void> {
    if (fileIds.length === 0) return;

    await this.pool.query(
      `DELETE FROM auction_files WHERE id = ANY($1)`,
      [fileIds]
    );

    logger.info('Deleted files from database', { count: fileIds.length });
  }

  async createAuctionFile(data: {
    lot_id: string | null;
    inventory_item_id: string | null;
    variant: string;
    b2_key: string;
    source_key: string | null;
    status: string;
    uploaded_from: string;
    file_size: number;
    width?: number;
    height?: number;
    format: string;
  }): Promise<{ id: string }> {
    const result = await this.pool.query<{ id: string }>(
      `INSERT INTO auction_files (
        lot_id,
        inventory_item_id,
        variant,
        b2_key,
        source_key,
        status,
        uploaded_from,
        file_size,
        width,
        height,
        format
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id`,
      [
        data.lot_id,
        data.inventory_item_id,
        data.variant,
        data.b2_key,
        data.source_key,
        data.status,
        data.uploaded_from,
        data.file_size,
        data.width || null,
        data.height || null,
        data.format
      ]
    );

    return result.rows[0];
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
