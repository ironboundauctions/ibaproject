import { supabase } from '../lib/supabase';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'http://localhost:3000';
const ANALYSIS_WORKER_URL = import.meta.env.VITE_ANALYSIS_WORKER_URL || 'http://localhost:3001';

export interface UploadedFileInfo {
  fileName: string;
  fileSize: number;
  mimeType: string;
  assetGroupId: string;
  cdnUrls: {
    source: string;
    display: string;
    thumb: string;
  };
  width: number;
  height: number;
}

export interface GroupedFile {
  fileName: string;
  assetGroupId: string;
}

export interface GroupedItem {
  inv_number: string;
  files: GroupedFile[];
}

export interface AnalysisResults {
  grouped: GroupedItem[];
  ungrouped: GroupedFile[];
  errors: { fileName: string; error: string }[];
}

export interface BatchAnalysisJob {
  id: string;
  user_id: string;
  status: 'pending' | 'analyzing' | 'ready_for_review' | 'processing' | 'confirmed' | 'failed' | 'expired' | 'cancelled';
  total_files: number;
  analysis_results: AnalysisResults;
  uploaded_files: UploadedFileInfo[];
  user_adjustments: any;
  created_at: string;
  updated_at: string;
  analyzed_at: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  expires_at: string;
  error_message: string | null;
}

export const bulkUploadService = {
  /**
   * Upload files to processing worker and get CDN URLs
   */
  async uploadFiles(files: File[], onProgress?: (current: number, total: number) => void): Promise<UploadedFileInfo[]> {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    const response = await fetch(`${WORKER_URL}/api/bulk-upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Bulk upload failed');
    }

    const data = await response.json();
    return data.uploadedFiles || [];
  },

  /**
   * Send uploaded files to analysis worker for barcode scanning
   */
  async analyzeBatch(uploadedFiles: UploadedFileInfo[]): Promise<AnalysisResults> {
    const formData = new FormData();

    // Send metadata instead of actual files (files are already on B2)
    const metadata = uploadedFiles.map(f => ({
      fileName: f.fileName,
      assetGroupId: f.assetGroupId,
    }));

    formData.append('metadata', JSON.stringify(metadata));

    // Note: For actual barcode scanning, we'd need to download and send the images
    // For now, we'll use a simpler approach where analysis worker returns mock data
    // In production, you'd fetch the images from CDN and send to analysis worker

    const response = await fetch(`${ANALYSIS_WORKER_URL}/api/analyze-batch`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Barcode analysis failed');
    }

    const data = await response.json();
    return {
      grouped: data.grouped || [],
      ungrouped: data.ungrouped || [],
      errors: data.errors || [],
    };
  },

  /**
   * Create batch analysis job in database
   */
  async createBatchJob(
    uploadedFiles: UploadedFileInfo[],
    analysisResults: AnalysisResults
  ): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('batch_analysis_jobs')
      .insert({
        user_id: user.id,
        status: 'ready_for_review',
        total_files: uploadedFiles.length,
        uploaded_files: uploadedFiles,
        analysis_results: analysisResults,
        user_adjustments: {},
        analyzed_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to create batch job: ${error.message}`);
    }

    return data.id;
  },

  /**
   * Update user adjustments in batch job
   */
  async updateUserAdjustments(jobId: string, adjustments: any): Promise<void> {
    const { error } = await supabase
      .from('batch_analysis_jobs')
      .update({
        user_adjustments: adjustments,
      })
      .eq('id', jobId);

    if (error) {
      throw new Error(`Failed to update adjustments: ${error.message}`);
    }
  },

  /**
   * Confirm batch and create inventory items
   */
  async confirmBatch(
    jobId: string,
    groups: Array<{
      inv_number: string;
      files: Array<{
        fileName: string;
        assetGroupId: string;
        cdnUrls: any;
        fileSize: number;
        mimeType: string;
        width: number;
        height: number;
      }>;
    }>
  ): Promise<{ created: string[]; errors: any[] }> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    // First, link files to database via processing worker
    const response = await fetch(`${WORKER_URL}/api/bulk-process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ groups }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Bulk process failed');
    }

    const processData = await response.json();

    // Now create inventory items for each group
    const createdItems: string[] = [];
    const errors: any[] = [];

    for (const group of groups) {
      try {
        // Check if inventory number already exists
        const { data: existing } = await supabase
          .from('inventory_items')
          .select('id')
          .eq('inventory_number', group.inv_number)
          .maybeSingle();

        if (existing) {
          errors.push({
            inv_number: group.inv_number,
            error: 'Inventory number already exists',
          });
          continue;
        }

        // Create new inventory item
        const { data: newItem, error: createError } = await supabase
          .from('inventory_items')
          .insert({
            inventory_number: group.inv_number,
            title: '',
            category: 'Uncategorized',
            status: 'cataloged',
          })
          .select('id')
          .single();

        if (createError) {
          errors.push({
            inv_number: group.inv_number,
            error: createError.message,
          });
          continue;
        }

        // Update auction_files to link to this item
        const assetGroupIds = group.files.map(f => f.assetGroupId);

        const { error: linkError } = await supabase
          .from('auction_files')
          .update({ item_id: newItem.id })
          .in('asset_group_id', assetGroupIds);

        if (linkError) {
          errors.push({
            inv_number: group.inv_number,
            error: `Item created but failed to link files: ${linkError.message}`,
          });
          continue;
        }

        createdItems.push(newItem.id);
      } catch (error) {
        errors.push({
          inv_number: group.inv_number,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Update batch job status
    const { error: updateError } = await supabase
      .from('batch_analysis_jobs')
      .update({
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    if (updateError) {
      console.warn('Failed to update batch job status:', updateError);
    }

    return { created: createdItems, errors };
  },

  /**
   * Cancel batch job and cleanup files
   */
  async cancelBatch(jobId: string, assetGroupIds: string[]): Promise<void> {
    // Delete files from B2
    if (assetGroupIds.length > 0) {
      try {
        await fetch(`${WORKER_URL}/api/delete-batch-files`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ assetGroupIds }),
        });
      } catch (error) {
        console.warn('Failed to delete batch files:', error);
      }
    }

    // Update batch job status
    const { error } = await supabase
      .from('batch_analysis_jobs')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    if (error) {
      console.warn('Failed to update batch job status:', error);
    }
  },

  /**
   * Delete specific files from batch
   */
  async deleteBatchFiles(assetGroupIds: string[]): Promise<void> {
    const response = await fetch(`${WORKER_URL}/api/delete-batch-files`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ assetGroupIds }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Delete batch files failed');
    }
  },

  /**
   * Get batch job status
   */
  async getJobStatus(jobId: string): Promise<BatchAnalysisJob> {
    const { data, error } = await supabase
      .from('batch_analysis_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) {
      throw new Error(`Failed to get job status: ${error.message}`);
    }

    return data;
  },
};
