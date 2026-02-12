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
  file_key: string;
  download_url: string;
  name: string;
  mime_type: string;
  size: number;
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
        raidState.downloadBase = data.download_base || 'https://raid.ibaproject.bid/download';
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
        raidState.downloadBase = data.download_base || 'https://raid.ibaproject.bid/download';
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

  static async uploadInventoryImages(
    files: File[],
    inventoryNumber: string,
    mainImageIndex: number = 0,
    onProgress?: (progress: { currentFile: number; totalFiles: number; percent: number; fileName: string }) => void
  ): Promise<{ mainImageUrl: string; additionalImageUrls: string[]; errors: string[] }> {
    try {
      if (!raidState?.ok) {
        console.log('[RAID] Gate check: raidState.ok is false, attempting one-time health refresh');
        try {
          await this.checkHealth();
          if (raidState?.ok) {
            console.log('[RAID] One-time health refresh succeeded');
          } else {
            console.error('[RAID] One-time health refresh failed: state still not OK');
          }
        } catch (error) {
          console.error('[RAID] One-time health refresh exception:', error);
        }
      }

      console.log('[RAID] upload gate check', {
        ok: raidState?.ok,
        provider: raidState?.provider,
        downloadBase: raidState?.downloadBase,
        lastChecked: raidState?.lastChecked
      });

      if (!raidState?.ok || raidState?.provider !== 'raid') {
        console.error('[RAID] Gate refused. last health:', raidState);
        throw new Error('RAID storage is not available. Please check the connection and try again.');
      }

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

          const downloadBase = raidState.downloadBase || 'https://raid.ibaproject.bid/download';

          for (const uploadedFile of result.files) {
            const file_key = `${SERVICE_USER_ID}/${uploadedFile.filename}`;
            const download_url = `${downloadBase}/${file_key}`;

            allFileMetadata.push({
              file_key,
              download_url,
              name: uploadedFile.originalName,
              mime_type: uploadedFile.mimeType,
              size: uploadedFile.size
            });
          }
        } catch (error) {
          console.error(`[RAID] Batch ${currentFile} exception:`, error);
          errors.push(`Batch ${currentFile} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // NOTE: We don't insert auction_files records here anymore!
      // The InventoryItemForm component handles inserting all file records after form save.
      // This prevents duplicate records and ensures proper cleanup if form is cancelled.

      const mainImageUrl = allFileMetadata[mainImageIndex]?.download_url || '';
      const additionalImageUrls = allFileMetadata
        .filter((_, index) => index !== mainImageIndex)
        .map(f => f.download_url);

      return {
        mainImageUrl,
        additionalImageUrls,
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
  static async getReferenceCount(file_key: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('auction_files')
        .select('*', { count: 'exact', head: true })
        .eq('file_key', file_key);

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
   * Delete a file from RAID and database with smart reference counting and ownership checking
   * @param file_key - The file key to delete
   * @param item_id - Optional item ID. If provided and file has multiple references, only deletes this item's record
   */
  static async deleteFile(file_key: string, item_id?: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Get file info to check ownership and reference count
      const { data: fileRecords, error: fetchError } = await supabase
        .from('auction_files')
        .select('source_user_id, item_id')
        .eq('file_key', file_key);

      if (fetchError) {
        console.error('[RAID] Error fetching file records:', fetchError);
        throw new Error('Failed to fetch file records from database');
      }

      const refCount = fileRecords?.length || 0;
      console.log(`[RAID] File ${file_key} has ${refCount} reference(s)`);

      // Check if this file is from IronDrive picker (has source_user_id)
      const isFromPicker = fileRecords && fileRecords.length > 0 && fileRecords[0].source_user_id !== null;

      if (isFromPicker) {
        console.log(`[RAID] File from IronDrive picker - NEVER delete from RAID, only database reference`);
      }

      // If multiple items reference this file and item_id is provided,
      // only delete the database record for this specific item
      if (refCount > 1 && item_id) {
        console.log(`[RAID] Multiple references exist. Deleting only item ${item_id}'s record`);
        const { error: deleteError } = await supabase
          .from('auction_files')
          .delete()
          .eq('file_key', file_key)
          .eq('item_id', item_id);

        if (deleteError) {
          console.error('[RAID] Error deleting file record:', deleteError);
          throw new Error('Failed to delete file record from database');
        }

        return { success: true };
      }

      // Last reference - check if we should delete from RAID
      if (isFromPicker) {
        // File is from IronDrive picker - ONLY delete database record, NEVER delete from RAID
        console.log(`[RAID] Last reference but file owned by IronDrive user - deleting database record only`);

        const { error: deleteError } = await supabase
          .from('auction_files')
          .delete()
          .eq('file_key', file_key);

        if (deleteError) {
          console.error('[RAID] Error deleting file record:', deleteError);
          throw new Error('Failed to delete file record from database');
        }

        return { success: true };
      }

      // File was uploaded by auction FE - safe to delete from RAID
      console.log(`[RAID] File uploaded by auction FE - deleting from RAID`);

      if (!raidState?.ok) {
        console.log('[RAID] Gate check: raidState.ok is false, attempting one-time health refresh');
        try {
          await this.checkHealth();
          if (raidState?.ok) {
            console.log('[RAID] One-time health refresh succeeded');
          } else {
            console.error('[RAID] One-time health refresh failed: state still not OK');
          }
        } catch (error) {
          console.error('[RAID] One-time health refresh exception:', error);
        }
      }

      if (!raidState?.ok || raidState?.provider !== 'raid') {
        throw new Error('RAID storage is not available');
      }

      const [, ...parts] = file_key.split('/');
      const serverFilename = parts.join('/');

      console.log(`[RAID] DELETE via RAID → file_key=${file_key} (last reference, auction FE owned)`);

      const response = await fetch(`${IRONDRIVE_API}/files/${SERVICE_USER_ID}/${encodeURIComponent(serverFilename)}`, {
        method: 'DELETE',
        headers: {
          'X-User-Id': SERVICE_USER_ID
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        const headers = Array.from(response.headers.entries());
        console.error('[RAID] Delete failed:', {
          status: response.status,
          headers: Object.fromEntries(headers),
          error: errorText
        });
        throw new Error(`Delete failed: ${response.status} - ${errorText}`);
      }

      // Delete all database records for this file
      const { error: deleteError } = await supabase
        .from('auction_files')
        .delete()
        .eq('file_key', file_key);

      if (deleteError) {
        console.error('[RAID] Error deleting file metadata:', deleteError);
        throw new Error('Failed to delete file metadata from database');
      }

      return { success: true };

    } catch (error) {
      console.error('[RAID] Delete error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Delete failed'
      };
    }
  }

  /**
   * Delete a file physically from RAID without checking references or database.
   * Use this when you've already checked references and just need to delete the physical file.
   */
  static async deleteFilePhysical(file_key: string): Promise<void> {
    if (!raidState?.ok || raidState?.provider !== 'raid') {
      throw new Error('RAID storage is not available');
    }

    const [, ...parts] = file_key.split('/');
    const serverFilename = parts.join('/');

    const response = await fetch(`${IRONDRIVE_API}/files/${SERVICE_USER_ID}/${encodeURIComponent(serverFilename)}`, {
      method: 'DELETE',
      headers: {
        'X-User-Id': SERVICE_USER_ID
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Delete failed: ${response.status} - ${errorText}`);
    }
  }

  static getDownloadUrl(file_key: string): string {
    const downloadBase = raidState.downloadBase || 'https://raid.ibaproject.bid/download';
    const [userId, ...filenameParts] = file_key.split('/');
    const filename = filenameParts.join('/');
    return `${downloadBase}/${userId}/${encodeURIComponent(filename)}`;
  }

  static async createFolder(folderName: string): Promise<{ success: boolean; message: string }> {
    try {
      if (!raidState?.ok) {
        console.log('[RAID] Gate check: raidState.ok is false, attempting one-time health refresh');
        try {
          await this.checkHealth();
          if (raidState?.ok) {
            console.log('[RAID] One-time health refresh succeeded');
          } else {
            console.error('[RAID] One-time health refresh failed: state still not OK');
          }
        } catch (error) {
          console.error('[RAID] One-time health refresh exception:', error);
        }
      }

      if (!raidState?.ok || raidState?.provider !== 'raid') {
        throw new Error('RAID storage is not available');
      }

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
    return this.getDownloadUrl(`${SERVICE_USER_ID}/${filename}`);
  }

  static getRaidState(): RaidState {
    return { ...raidState };
  }
}
