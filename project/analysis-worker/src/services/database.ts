import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config.js';
import { logger } from '../logger.js';
import type { BatchAnalysisJob, AnalysisResult } from '../types.js';

export class DatabaseService {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = createClient(
      config.supabase.url,
      config.supabase.serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }

  async getPendingJobs(limit: number = 10): Promise<BatchAnalysisJob[]> {
    const { data, error } = await this.supabase
      .from('batch_analysis_jobs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      logger.error('Failed to fetch pending jobs', { error: error.message });
      throw error;
    }

    return data || [];
  }

  async updateJobStatus(
    jobId: string,
    status: BatchAnalysisJob['status'],
    updates: Partial<BatchAnalysisJob> = {}
  ): Promise<void> {
    const payload: Partial<BatchAnalysisJob> = {
      status,
      ...updates,
    };

    if (status === 'completed' || status === 'failed') {
      payload.completed_at = new Date().toISOString();
    }

    const { error } = await this.supabase
      .from('batch_analysis_jobs')
      .update(payload)
      .eq('id', jobId);

    if (error) {
      logger.error('Failed to update job status', {
        jobId,
        status,
        error: error.message,
      });
      throw error;
    }

    logger.info('Job status updated', { jobId, status });
  }

  async updateJobProgress(
    jobId: string,
    processedFiles: number,
    results: AnalysisResult[]
  ): Promise<void> {
    const { error } = await this.supabase
      .from('batch_analysis_jobs')
      .update({
        processed_files: processedFiles,
        results,
      })
      .eq('id', jobId);

    if (error) {
      logger.error('Failed to update job progress', {
        jobId,
        processedFiles,
        error: error.message,
      });
      throw error;
    }
  }

  async setJobError(jobId: string, errorMessage: string): Promise<void> {
    await this.updateJobStatus(jobId, 'failed', {
      error_message: errorMessage,
    });
  }
}
