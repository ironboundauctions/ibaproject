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
   * STEP 1: Analyze file buffers for barcodes BEFORE uploading
   * Sends actual file buffers to analysis worker for barcode scanning
   */
  async analyzeBatch(files: File[], onProgress?: (current: number, total: number) => void): Promise<AnalysisResults & { fileMap: Map<string, File> }> {
    const formData = new FormData();

    // Send actual file buffers for barcode scanning
    files.forEach(file => {
      formData.append('files', file);
    });

    const response = await fetch(`${ANALYSIS_WORKER_URL}/api/analyze-batch`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Barcode analysis failed');
    }

    const data = await response.json();

    // Create a map of fileName to File object for later upload
    const fileMap = new Map<string, File>();
    files.forEach(file => {
      fileMap.set(file.name, file);
    });

    return {
      grouped: data.grouped || [],
      ungrouped: data.ungrouped || [],
      errors: data.errors || [],
      fileMap,
    };
  },

  /**
   * STEP 2: Create batch job in database with analysis results (no uploads yet)
   */
  async createBatchJob(
    files: File[],
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
        total_files: files.length,
        uploaded_files: [], // Empty until confirmation
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
   * STEP 3: After user confirms, upload files to processing worker
   * Only uploads the files user confirmed in the modal
   */
  async uploadConfirmedFiles(
    files: File[],
    onProgress?: (current: number, total: number) => void
  ): Promise<UploadedFileInfo[]> {
    const CHUNK_SIZE = 5; // Upload 5 files at a time
    const uploadedFiles: UploadedFileInfo[] = [];

    for (let i = 0; i < files.length; i += CHUNK_SIZE) {
      const chunk = files.slice(i, i + CHUNK_SIZE);
      const formData = new FormData();

      chunk.forEach(file => {
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
      uploadedFiles.push(...(data.uploadedFiles || []));

      if (onProgress) {
        onProgress(Math.min(i + CHUNK_SIZE, files.length), files.length);
      }
    }

    return uploadedFiles;
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
   * STEP 4: After files uploaded, confirm batch and create inventory items
   */
  async confirmBatch(
    jobId: string,
    uploadedFiles: UploadedFileInfo[],
    groups: Array<{
      inv_number: string;
      files: Array<{
        fileName: string;
        assetGroupId: string;
      }>;
    }>
  ): Promise<{ created: string[]; errors: any[] }> {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    // Map uploaded files to groups
    const fileMap = new Map(uploadedFiles.map(f => [f.fileName, f]));

    const groupsWithMetadata = groups.map(group => ({
      ...group,
      files: group.files.map(f => {
        const uploaded = fileMap.get(f.fileName);
        return {
          ...f,
          cdnUrls: uploaded?.cdnUrls,
          fileSize: uploaded?.fileSize,
          mimeType: uploaded?.mimeType,
          width: uploaded?.width,
          height: uploaded?.height,
          assetGroupId: uploaded?.assetGroupId || f.assetGroupId,
        };
      }),
    }));

    // Link files to database via processing worker
    const response = await fetch(`${WORKER_URL}/api/bulk-process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ groups: groupsWithMetadata }),
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

        // Get the barcode image (first file in group) CDN URL
        const barcodeFile = group.files[0];
        const uploadedBarcodeFile = fileMap.get(barcodeFile?.fileName);
        const barcodeImageUrl = uploadedBarcodeFile?.cdnUrls?.display || uploadedBarcodeFile?.cdnUrls?.thumb;

        // Create new inventory item
        const { data: newItem, error: createError } = await supabase
          .from('inventory_items')
          .insert({
            inventory_number: group.inv_number,
            title: '',
            category: 'Uncategorized',
            status: 'cataloged',
            barcode_image_url: barcodeImageUrl,
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

        console.log('[BULK] Attempting to link files to item', {
          inv_number: group.inv_number,
          item_id: newItem.id,
          assetGroupIds,
          fileCount: group.files.length,
        });

        // First check if files exist in auction_files
        const { data: existingFiles, error: checkError } = await supabase
          .from('auction_files')
          .select('id, asset_group_id, item_id, variant')
          .in('asset_group_id', assetGroupIds);

        console.log('[BULK] Existing files check:', {
          inv_number: group.inv_number,
          existingCount: existingFiles?.length || 0,
          existing: existingFiles,
          checkError,
        });

        if (!existingFiles || existingFiles.length === 0) {
          console.error('[BULK] No files found in database for asset groups');
          errors.push({
            inv_number: group.inv_number,
            error: `Item created but no files found in database. Expected ${assetGroupIds.length} asset groups.`,
          });
          continue;
        }

        const { data: linkedFiles, error: linkError } = await supabase
          .from('auction_files')
          .update({ item_id: newItem.id })
          .in('asset_group_id', assetGroupIds)
          .select('id, asset_group_id');

        if (linkError) {
          console.error('[BULK] Failed to link files:', linkError);
          errors.push({
            inv_number: group.inv_number,
            error: `Item created but failed to link files: ${linkError.message}`,
          });
          continue;
        }

        console.log('[BULK] Files linked successfully:', {
          inv_number: group.inv_number,
          linked_count: linkedFiles?.length || 0,
          expected_count: assetGroupIds.length,
        });

        createdItems.push(newItem.id);
      } catch (error) {
        errors.push({
          inv_number: group.inv_number,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Update batch job with uploaded files and confirm status
    const { error: updateError } = await supabase
      .from('batch_analysis_jobs')
      .update({
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        uploaded_files: uploadedFiles,
      })
      .eq('id', jobId);

    if (updateError) {
      console.warn('Failed to update batch job status:', updateError);
    }

    return { created: createdItems, errors };
  },

  /**
   * Cancel batch job - no files to cleanup since nothing uploaded yet
   */
  async cancelBatch(jobId: string): Promise<void> {
    // Update batch job status (no files to delete since we haven't uploaded yet)
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
