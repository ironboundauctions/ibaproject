import { supabase } from '../lib/supabase';

const SERVICE_USER_ID = 'e9478d39-cde3-4184-bf0b-0e198ef029d2';
const IRONDRIVE_API = import.meta.env.VITE_IRONDRIVE_API || '';

console.log('[RAID] SERVICE_USER_ID', SERVICE_USER_ID);

type RaidState = {
  ok: boolean;
  provider: 'raid' | 'cloud' | null;
  downloadBase: string | null;
  lastChecked: number | null;
};

const raidState: RaidState = {
  ok: false,
  provider: null,
  downloadBase: null,
  lastChecked: null
};

interface HealthResponse {
  status: string;
  provider?: string | {
    storage?: {
      storage_provider?: {
        source?: string[];
      };
    };
  };
  download_base?: string;
}

interface UploadResult {
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
}

interface UploadResponse {
  success: boolean;
  files?: UploadResult[];
  error?: string;
}

interface FileMetadata {
  source_key: string;
  original_name: string;
  mime_type?: string;
  size?: number;
}

export class IronDriveService {
  private static uploadWithProgress(
    url: string,
    formData: FormData,
    userId: string,
    onProgress: (percent: number) => void
  ): Promise<{ ok: boolean; status: number; data?: any; errorText?: string }> {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          onProgress(percentComplete);
        }
      });

      xhr.addEventListener('load', async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve({ ok: true, status: xhr.status, data });
          } catch (error) {
            resolve({ ok: false, status: xhr.status, errorText: 'Invalid JSON response' });
          }
        } else {
          resolve({ ok: false, status: xhr.status, errorText: xhr.responseText });
        }
      });

      xhr.addEventListener('error', () => {
        resolve({ ok: false, status: 0, errorText: 'Network error' });
      });

      xhr.addEventListener('abort', () => {
        resolve({ ok: false, status: 0, errorText: 'Upload aborted' });
      });

      xhr.open('POST', url);
      xhr.setRequestHeader('X-User-Id', userId);
      xhr.send(formData);
    });
  }
  static async checkHealth(): Promise<{ success: boolean; message: string; raidAvailable: boolean }> {
    try {
      console.log('[RAID] Checking health at:', `${IRONDRIVE_API}/health`);

      const response = await fetch(`${IRONDRIVE_API}/health`, {
        method: 'GET',
        headers: {}
      });

      if (!response.ok) {
        const headers = Array.from(response.headers.entries());
        console.error('[RAID] Health check failed:', {
          status: response.status,
          headers: Object.fromEntries(headers),
          statusText: response.statusText
        });
        raidState.ok = false;
        raidState.provider = null;
        return {
          success: false,
          message: `Health check failed: ${response.status}`,
          raidAvailable: false
        };
      }

      const data: HealthResponse = await response.json();
      console.log('[RAID] Health response:', data);

      if (data.status === 'ok' && data.provider === 'raid') {
        raidState.ok = true;
        raidState.provider = 'raid';
        raidState.downloadBase = data.download_base || 'https://raid.ibaproject.bid/pub/download';
        raidState.lastChecked = Date.now();

        console.log(`[RAID] HEALTH OK (raid) download_base=${raidState.downloadBase}`);

        return {
          success: true,
          message: 'RAID storage is available',
          raidAvailable: true
        };
      }

      const sources = typeof data.provider === 'object'
        ? data.provider?.storage?.storage_provider?.source || []
        : [];

      const isRaidAvailable = sources.includes('raid');

      if (isRaidAvailable) {
        raidState.ok = true;
        raidState.provider = 'raid';
        raidState.downloadBase = data.download_base || 'https://raid.ibaproject.bid/pub/download';
        raidState.lastChecked = Date.now();

        console.log(`[RAID] HEALTH OK (raid) download_base=${raidState.downloadBase}`);

        return {
          success: true,
          message: 'RAID storage is available',
          raidAvailable: true
        };
      }

      raidState.ok = false;
      raidState.provider = null;
      return {
        success: false,
        message: 'RAID storage not available',
        raidAvailable: false
      };
    } catch (error) {
      console.error('[RAID] Health check error:', error);
      raidState.ok = false;
      raidState.provider = null;
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Health check failed',
        raidAvailable: false
      };
    }
  }

  /**
   * Upload images from PC to RAID storage
   * After upload, these files go through the SAME publishing pipeline as picker files
   * Returns source_keys that can be used to create auction_files records
   */
  static async uploadInventoryImages(
    files: File[],
    inventoryNumber: string,
    mainImageIndex: number = 0,
    onProgress?: (progress: { currentFile: number; totalFiles: number; percent: number; fileName: string }) => void
  ): Promise<{ mainImageUrl: string; additionalImageUrls: string[]; errors: string[] }> {
    try {
      console.log(`[RAID] Starting upload of ${files.length} images for inventory ${inventoryNumber}`);

      const BATCH_SIZE = 1;
      const batches: File[][] = [];
      for (let i = 0; i < files.length; i += BATCH_SIZE) {
        batches.push(files.slice(i, i + BATCH_SIZE));
      }

      console.log(`[RAID] Uploading ${files.length} images in ${batches.length} batches for inventory ${inventoryNumber}`);

      const errors: string[] = [];
      const allFileMetadata: FileMetadata[] = [];

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const currentFile = batchIndex + 1;
        const fileName = batch[0].name;

        console.log(`[RAID] Batch ${currentFile}/${batches.length}: Uploading ${batch.length} files...`);

        const formData = new FormData();
        batch.forEach((file) => {
          formData.append('files', file);
        });

        try {
          const uploadResult = await this.uploadWithProgress(
            `${IRONDRIVE_API}/upload`,
            formData,
            SERVICE_USER_ID,
            (percent) => {
              if (onProgress) {
                onProgress({
                  currentFile,
                  totalFiles: files.length,
                  percent,
                  fileName
                });
              }
            }
          );

          if (!uploadResult.ok) {
            const errorText = uploadResult.errorText || '';
            console.error(`[RAID] Batch ${currentFile} failed:`, {
              status: uploadResult.status,
              error: errorText
            });
            errors.push(`Batch ${currentFile} failed: ${uploadResult.status}`);
            continue;
          }

          const result: UploadResponse = uploadResult.data;
          console.log(`[RAID] Batch ${currentFile}/${batches.length} succeeded`);

          if (!result.success || !result.files) {
            errors.push(`Batch ${currentFile} returned invalid response`);
            continue;
          }

          for (const uploadedFile of result.files) {
            const source_key = `${SERVICE_USER_ID}/${uploadedFile.filename}`;

            allFileMetadata.push({
              source_key,
              original_name: uploadedFile.originalName,
              mime_type: uploadedFile.mimeType,
              size: uploadedFile.size
            });
          }
        } catch (error) {
          console.error(`[RAID] Batch ${currentFile} exception:`, error);
          errors.push(`Batch ${currentFile} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      console.log('[RAID] Upload complete:', allFileMetadata.length, 'files uploaded');

      const mainImage = allFileMetadata[mainImageIndex] || allFileMetadata[0];
      const additionalImages = allFileMetadata.filter((_, i) => i !== (mainImageIndex || 0));

      return {
        mainImageUrl: mainImage?.source_key || '',
        additionalImageUrls: additionalImages.map(f => f.source_key),
        errors
      };

    } catch (error) {
      console.error('[RAID] Upload error:', error);
      return {
        mainImageUrl: '',
        additionalImageUrls: [],
        errors: [error instanceof Error ? error.message : 'Upload failed']
      };
    }
  }

  /**
   * Upload a single image from PC to RAID storage
   * Wrapper around uploadInventoryImages for single file uploads
   */
  static async uploadImage(
    file: File,
    inventoryNumber: string,
    imageIndex: number = 0,
    isMainImage: boolean = false
  ): Promise<{ success: boolean; url?: string; filename?: string; error?: string }> {
    try {
      const result = await this.uploadInventoryImages([file], inventoryNumber, isMainImage ? 0 : imageIndex);

      if (result.errors.length > 0) {
        return {
          success: false,
          error: result.errors[0]
        };
      }

      const url = isMainImage ? result.mainImageUrl : result.additionalImageUrls[0];

      return {
        success: true,
        url: url,
        filename: url.split('/').pop()
      };

    } catch (error) {
      console.error('[RAID] Upload error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    }
  }

  /**
   * Get the number of items referencing a specific file
   */
  static async getReferenceCount(source_key: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('auction_files')
        .select('*', { count: 'exact', head: true })
        .eq('source_key', source_key)
        .eq('variant', 'source');

      if (error) {
        console.error('[RAID] Error getting reference count:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('[RAID] Exception getting reference count:', error);
      return 0;
    }
  }

  /**
   * Detach media from item (soft delete)
   * Sets detached_at timestamp. Files kept for 30 days before purging.
   * NEVER deletes RAID originals - they are permanent master archive.
   * @param asset_group_id - The asset group to detach
   */
  static async deleteFile(asset_group_id: string, item_id?: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`[RAID] Soft deleting asset_group_id=${asset_group_id}`);

      // Set detached_at timestamp (soft delete)
      const { error: updateError } = await supabase
        .from('auction_files')
        .update({ detached_at: new Date().toISOString() })
        .eq('asset_group_id', asset_group_id);

      if (updateError) {
        console.error('[RAID] Error setting detached_at:', updateError);
        throw new Error('Failed to detach file');
      }

      console.log(`[RAID] Successfully detached asset_group_id=${asset_group_id}`);
      return { success: true };

    } catch (error) {
      console.error('[RAID] Detach error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Detach failed'
      };
    }
  }

  /**
   * Get CDN URL for a published variant
   * @param b2_key - The B2 object key
   */
  static getCdnUrl(b2_key: string): string {
    const cdnBase = import.meta.env.VITE_CDN_BASE_URL || 'https://cdn.ibaproject.bid/file/IBA-Lot-Media';
    return `${cdnBase}/${b2_key}`;
  }

  /**
   * Create a folder in RAID storage for organizing files
   */
  static async createFolder(folderName: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${IRONDRIVE_API}/create-folder`, {
        method: 'POST',
        headers: {
          'X-User-Id': SERVICE_USER_ID,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: SERVICE_USER_ID,
          folder: folderName
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        const headers = Array.from(response.headers.entries());
        console.error('[RAID] Create folder failed:', {
          status: response.status,
          headers: Object.fromEntries(headers),
          error: errorText
        });
        throw new Error(`Create folder failed: ${response.status} - ${errorText}`);
      }

      return {
        success: true,
        message: `Folder '${folderName}' created successfully`
      };

    } catch (error) {
      console.error('[RAID] Create folder error:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Create folder failed'
      };
    }
  }

  static async testConnection(): Promise<{ success: boolean; message: string }> {
    const result = await this.checkHealth();
    return {
      success: result.success,
      message: result.message
    };
  }

  static isRaidAvailable(): boolean {
    return raidState?.ok === true && raidState?.provider === 'raid';
  }

  static getImageUrl(productId: string, filename: string): string {
    return this.getCdnUrl(`assets/${productId}/display.webp`);
  }

  static getRaidState(): RaidState {
    return { ...raidState };
  }
}
