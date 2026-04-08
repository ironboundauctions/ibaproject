import { supabase } from '../lib/supabase';
import { BarcodeScanner } from '../utils/barcodeScanner';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'http://localhost:3000';
const ANALYSIS_WORKER_URL = import.meta.env.VITE_ANALYSIS_WORKER_URL || 'http://localhost:3001'; // Kept for potential revert

export interface UploadedFileInfo {
  fileName: string;
  fileSize: number;
  mimeType: string;
  assetGroupId: string;
  sourceKey?: string;
  cdnUrls: {
    source: string;
    display: string;
    thumb: string;
  };
  width: number;
  height: number;
  barcodeValue?: string;
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
   * STEP 1: Analyze files for barcodes in the browser using Web Workers
   * BROWSER-SIDE SCANNING - No network calls, much faster!
   */
  async analyzeBatch(files: File[], onProgress?: (current: number, total: number) => void): Promise<AnalysisResults> {
    console.log('[BULK-UPLOAD] Starting browser-side barcode analysis for', files.length, 'files');

    // Scan all files in parallel using Web Workers
    const scanResults = await BarcodeScanner.scanBatch(files, onProgress);

    console.log('[BULK-UPLOAD] Scan results:', {
      total: scanResults.length,
      withBarcode: scanResults.filter(r => r.barcode).length,
      withoutBarcode: scanResults.filter(r => !r.barcode).length,
    });

    // Group files by barcode (sequential grouping logic)
    const grouped: GroupedItem[] = [];
    const ungrouped: GroupedFile[] = [];
    const errors: { fileName: string; error: string }[] = [];

    let currentGroup: GroupedItem | null = null;

    console.log('[BULK-UPLOAD] 📦 Starting grouping logic...');

    for (let i = 0; i < scanResults.length; i++) {
      const result = scanResults[i];
      const file = files[i];

      // Generate a temporary asset group ID for this file
      const tempAssetGroupId = `temp-${Date.now()}-${i}`;

      if (result.barcode) {
        // Start a new group
        if (currentGroup) {
          console.log(`[BULK-UPLOAD] 🔒 Closing group "${currentGroup.inv_number}" with ${currentGroup.files.length} files`);
          grouped.push(currentGroup);
        }
        console.log(`[BULK-UPLOAD] 🆕 Starting NEW group with barcode "${result.barcode}" (file: ${result.fileName})`);
        currentGroup = {
          inv_number: result.barcode,
          files: [{
            fileName: result.fileName,
            assetGroupId: tempAssetGroupId,
          }],
        };
      } else {
        // Add to current group or ungrouped
        if (currentGroup) {
          console.log(`[BULK-UPLOAD] ➕ Adding ${result.fileName} to current group "${currentGroup.inv_number}" (now ${currentGroup.files.length + 1} files)`);
          currentGroup.files.push({
            fileName: result.fileName,
            assetGroupId: tempAssetGroupId,
          });
        } else {
          console.log(`[BULK-UPLOAD] ⚠️ UNGROUPED: ${result.fileName} (no current group)`);
          ungrouped.push({
            fileName: result.fileName,
            assetGroupId: tempAssetGroupId,
          });
        }
      }
    }

    // Don't forget the last group
    if (currentGroup) {
      console.log(`[BULK-UPLOAD] 🔒 Closing FINAL group "${currentGroup.inv_number}" with ${currentGroup.files.length} files`);
      grouped.push(currentGroup);
    }

    console.log('[BULK-UPLOAD] 📊 Grouping complete:', {
      grouped: grouped.length,
      ungrouped: ungrouped.length,
      errors: errors.length,
    });

    return {
      grouped,
      ungrouped,
      errors,
    };
  },

  /**
   * Build analysis results from already-uploaded files that have worker-scanned barcodes.
   * Used for IronDrive flow where barcode scanning happens server-side during upload.
   */
  analyzeFromUploadedFiles(uploaded: UploadedFileInfo[]): AnalysisResults {
    const grouped: GroupedItem[] = [];
    const ungrouped: GroupedFile[] = [];
    const errors: { fileName: string; error: string }[] = [];

    let currentGroup: GroupedItem | null = null;

    for (const up of uploaded) {
      if (up.barcodeValue) {
        if (currentGroup) {
          grouped.push(currentGroup);
        }
        currentGroup = {
          inv_number: up.barcodeValue,
          files: [{ fileName: up.fileName, assetGroupId: up.assetGroupId }],
        };
      } else {
        if (currentGroup) {
          currentGroup.files.push({ fileName: up.fileName, assetGroupId: up.assetGroupId });
        } else {
          ungrouped.push({ fileName: up.fileName, assetGroupId: up.assetGroupId });
        }
      }
    }

    if (currentGroup) {
      grouped.push(currentGroup);
    }

    return { grouped, ungrouped, errors };
  },

  /* REVERT POINT 1: WORKER-BASED ANALYSIS (COMMENTED OUT FOR TESTING)
   *
   * If browser-side scanning doesn't work well, uncomment this method
   * and remove the analyzeBatch method above.
   *
   * Original worker-based implementation:
   *
  async analyzeBatchViaWorker(files: File[], onProgress?: (current: number, total: number) => void): Promise<AnalysisResults & { fileMap: Map<string, File> }> {
    console.log('[BULK-UPLOAD-WORKER] Starting barcode analysis for', files.length, 'files');
    console.log('[BULK-UPLOAD-WORKER] Analysis worker URL:', ANALYSIS_WORKER_URL);

    const CHUNK_SIZE = 40;
    const chunks: File[][] = [];

    for (let i = 0; i < files.length; i += CHUNK_SIZE) {
      chunks.push(files.slice(i, i + CHUNK_SIZE));
    }

    console.log(`[BULK-UPLOAD-WORKER] Processing ${files.length} files in ${chunks.length} chunks`);

    const allGrouped: GroupedItem[] = [];
    const allUngrouped: GroupedFile[] = [];
    const allErrors: { fileName: string; error: string }[] = [];

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      const chunkStart = chunkIndex * CHUNK_SIZE;

      const formData = new FormData();
      chunk.forEach(file => formData.append('files', file));

      const response = await fetch(`${ANALYSIS_WORKER_URL}/api/analyze-batch`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = `Chunk ${chunkIndex + 1} failed`;
        try {
          const error = await response.json();
          errorMessage = error.message || errorMessage;
        } catch {
          const errorText = await response.text();
          errorMessage = errorText || `Analysis failed with status ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (data.grouped) allGrouped.push(...data.grouped);
      if (data.ungrouped) allUngrouped.push(...data.ungrouped);
      if (data.errors) allErrors.push(...data.errors);

      if (onProgress) {
        onProgress(Math.min(chunkStart + chunk.length, files.length), files.length);
      }
    }

    const fileMap = new Map<string, File>();
    files.forEach(file => fileMap.set(file.name, file));

    return {
      grouped: allGrouped,
      ungrouped: allUngrouped,
      errors: allErrors,
      fileMap,
    };
  },
  * END OF REVERT POINT 1 */

  /**
   * Upload IronDrive files via worker: worker downloads from RAID, processes, uploads to B2
   * Returns UploadedFileInfo[] with CDN URLs just like uploadConfirmedFiles does for PC uploads
   */
  async uploadIronDriveFiles(
    sourceKeys: string[],
    onProgress?: (current: number, total: number) => void
  ): Promise<UploadedFileInfo[]> {
    const CHUNK_SIZE = 10;
    const uploadedFiles: UploadedFileInfo[] = [];

    for (let i = 0; i < sourceKeys.length; i += CHUNK_SIZE) {
      const chunk = sourceKeys.slice(i, i + CHUNK_SIZE);

      const response = await fetch(`${WORKER_URL}/api/irondrive-bulk-upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceKeys: chunk }),
      });

      if (!response.ok) {
        let errorMessage = 'IronDrive upload failed';
        try {
          const error = await response.json();
          errorMessage = error.message || errorMessage;
        } catch {
          const errorText = await response.text();
          errorMessage = errorText || `Upload failed with status ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      uploadedFiles.push(...(data.uploadedFiles || []));

      if (onProgress) {
        onProgress(Math.min(i + CHUNK_SIZE, sourceKeys.length), sourceKeys.length);
      }
    }

    return uploadedFiles;
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
        let errorMessage = 'Bulk upload failed';
        try {
          const error = await response.json();
          errorMessage = error.message || errorMessage;
        } catch {
          const errorText = await response.text();
          errorMessage = errorText || `Upload failed with status ${response.status}`;
        }
        throw new Error(errorMessage);
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
    }>,
    isIronDrive: boolean = false
  ): Promise<{ created: string[]; errors: any[] }> {
    console.log('[BULK-UPLOAD] Starting confirmBatch:', {
      jobId,
      uploadedFilesCount: uploadedFiles.length,
      groupsCount: groups.length
    });

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    console.log('[BULK-UPLOAD] User authenticated:', user.id);

    // Map uploaded files to groups
    const fileMap = new Map(uploadedFiles.map(f => [f.fileName, f]));
    console.log('[BULK-UPLOAD] Created file map with', fileMap.size, 'files');

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

    console.log('[BULK-UPLOAD] Groups with metadata:', groupsWithMetadata.map(g => ({
      inv_number: g.inv_number,
      fileCount: g.files.length,
      assetGroupIds: g.files.map(f => f.assetGroupId)
    })));

    // Link files to database
    if (isIronDrive) {
      // For IronDrive files, create auction_files records directly
      console.log('[BULK-UPLOAD] Creating auction_files records for IronDrive files...');

      for (const group of groupsWithMetadata) {
        for (let i = 0; i < group.files.length; i++) {
          const file = group.files[i];
          const uploaded = fileMap.get(file.fileName);

          if (!uploaded) {
            console.error('[BULK-UPLOAD] No uploaded file info for:', file.fileName);
            continue;
          }

          const { error: insertError } = await supabase.from('auction_files').insert({
            item_id: null, // Will be set when inventory item is created
            asset_group_id: file.assetGroupId,
            variant: 'source',
            source_key: uploaded.cdnUrls.source,
            original_name: file.fileName,
            mime_type: uploaded.mimeType,
            published_status: 'pending',
            display_order: i
          });

          if (insertError) {
            console.error('[BULK-UPLOAD] Error inserting auction_file:', insertError);
            throw new Error(`Failed to create auction_file for ${file.fileName}: ${insertError.message}`);
          }
        }
      }

      console.log('[BULK-UPLOAD] IronDrive auction_files created successfully');
    } else {
      // For PC files, use worker to process files
      console.log('[BULK-UPLOAD] Calling bulk-process endpoint...');
      const response = await fetch(`${WORKER_URL}/api/bulk-process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ groups: groupsWithMetadata }),
      });

      if (!response.ok) {
        let errorMessage = 'Bulk process failed';
        try {
          const error = await response.json();
          errorMessage = error.message || errorMessage;
        } catch {
          const errorText = await response.text();
          errorMessage = errorText || `Process failed with status ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      const processData = await response.json();
      console.log('[BULK-UPLOAD] Bulk-process response:', processData);
    }

    // Now create inventory items for each group
    const createdItems: string[] = [];
    const errors: any[] = [];

    console.log('[BULK-UPLOAD] Creating inventory items for', groups.length, 'groups');

    for (const group of groups) {
      console.log('[BULK-UPLOAD] Processing group:', group.inv_number, 'with', group.files.length, 'files');
      try {
        // Check if inventory number already exists (including soft-deleted items)
        console.log('[BULK-UPLOAD] Checking if inventory number exists:', group.inv_number);
        const { data: existing } = await supabase
          .from('inventory_items')
          .select('id, deleted_at')
          .eq('inventory_number', group.inv_number)
          .maybeSingle();

        if (existing) {
          if (existing.deleted_at) {
            console.error('[BULK-UPLOAD] Inventory number exists in Recently Removed:', group.inv_number);
            errors.push({
              inv_number: group.inv_number,
              error: 'Item exists in Recently Removed - restore or permanently delete it first',
              isInRecentlyRemoved: true,
            });
          } else {
            console.error('[BULK-UPLOAD] Inventory number already exists:', group.inv_number);
            errors.push({
              inv_number: group.inv_number,
              error: 'Inventory number already exists',
              isInRecentlyRemoved: false,
            });
          }
          continue;
        }

        console.log('[BULK-UPLOAD] Inventory number is unique, creating item...');

        // Get the barcode image (first file in group) CDN URL
        const barcodeFile = group.files[0];
        const uploadedBarcodeFile = fileMap.get(barcodeFile?.fileName);
        const barcodeImageUrl = uploadedBarcodeFile?.cdnUrls?.display || uploadedBarcodeFile?.cdnUrls?.thumb;
        const barcodeAssetGroupId = barcodeFile?.assetGroupId;

        console.log('[BULK-UPLOAD] Barcode info:', {
          fileName: barcodeFile?.fileName,
          assetGroupId: barcodeAssetGroupId,
          imageUrl: barcodeImageUrl
        });

        // Create new inventory item
        const { data: newItem, error: createError } = await supabase
          .from('inventory_items')
          .insert({
            inventory_number: group.inv_number,
            title: '',
            category: 'Uncategorized',
            status: 'cataloged',
            barcode_image_url: barcodeImageUrl,
            barcode_asset_group_id: barcodeAssetGroupId,
          })
          .select('id')
          .single();

        if (createError) {
          console.error('[BULK-UPLOAD] Failed to create item:', createError);
          errors.push({
            inv_number: group.inv_number,
            error: createError.message,
          });
          continue;
        }

        console.log('[BULK-UPLOAD] Created inventory item:', newItem.id);

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

        console.log('[BULK-UPLOAD] Successfully created and linked item:', group.inv_number);
        createdItems.push(newItem.id);
      } catch (error) {
        console.error('[BULK-UPLOAD] Exception creating item:', error);
        errors.push({
          inv_number: group.inv_number,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    console.log('[BULK-UPLOAD] Batch processing complete:', {
      created: createdItems.length,
      errors: errors.length
    });

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
   * Immediately persist uploaded file info to DB so expiry cleanup can find them
   * Call this right after IronDrive files are uploaded to B2
   */
  async persistUploadedFiles(jobId: string, uploadedFiles: UploadedFileInfo[]): Promise<void> {
    const { error } = await supabase
      .from('batch_analysis_jobs')
      .update({ uploaded_files: uploadedFiles })
      .eq('id', jobId);

    if (error) {
      console.warn('Failed to persist uploaded files to batch job:', error);
    }
  },

  /**
   * Update batch job analysis results after scanning
   */
  async updateBatchAnalysis(jobId: string, files: File[], analysisResults: AnalysisResults): Promise<void> {
    const { error } = await supabase
      .from('batch_analysis_jobs')
      .update({
        status: 'ready_for_review',
        total_files: files.length,
        analysis_results: analysisResults,
        analyzed_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    if (error) {
      console.warn('Failed to update batch analysis:', error);
    }
  },

  /**
   * Cancel batch job - deletes any B2 files that were already uploaded
   */
  async cancelBatch(jobId: string, uploadedFiles?: UploadedFileInfo[]): Promise<void> {
    // Delete any files already uploaded to B2
    if (uploadedFiles && uploadedFiles.length > 0) {
      const assetGroupIds = uploadedFiles.map(f => f.assetGroupId);
      try {
        await fetch(`${WORKER_URL}/api/delete-batch-files`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assetGroupIds }),
        });
      } catch (err) {
        console.warn('Failed to delete B2 files on cancel (will be cleaned up by expiry):', err);
      }
    }

    if (!jobId) return;

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
