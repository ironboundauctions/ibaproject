import { supabase } from '../lib/supabase';
import { generateUUID } from '../utils/formatters';

export interface UploadedFile {
  id: string;
  path: string;
  publicUrl: string;
  cdnUrl: string;
  name: string;
  size: number;
  mimeType: string;
  isVideo: boolean;
}

interface B2UploadResponse {
  success: boolean;
  path?: string;
  url?: string;
  cdnUrl?: string;
  error?: string;
}

export class StorageService {
  private static getEdgeFunctionUrl(): string {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    return `${supabaseUrl}/functions/v1/upload-to-b2`;
  }

  static async uploadFile(
    file: File,
    itemId: string,
    onProgress?: (progress: number) => void
  ): Promise<UploadedFile> {
    try {
      console.log('[B2] Uploading file to B2:', file.name);

      const formData = new FormData();
      formData.append('file', file);
      formData.append('itemId', itemId);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(this.getEdgeFunctionUrl(), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[B2] Upload failed:', errorText);
        throw new Error(`Upload failed: ${errorText}`);
      }

      const result: B2UploadResponse = await response.json();

      if (!result.success || !result.path || !result.cdnUrl) {
        throw new Error(result.error || 'Upload failed');
      }

      console.log('[B2] Upload successful:', result.cdnUrl);

      return {
        id: generateUUID(),
        path: result.path,
        publicUrl: result.url || result.cdnUrl,
        cdnUrl: result.cdnUrl,
        name: file.name,
        size: file.size,
        mimeType: file.type,
        isVideo: file.type.startsWith('video/')
      };
    } catch (error) {
      console.error('[B2] Upload failed:', error);
      throw error;
    }
  }

  static async uploadFiles(
    files: File[],
    itemId: string,
    onProgress?: (current: number, total: number) => void
  ): Promise<UploadedFile[]> {
    const results: UploadedFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (onProgress) {
        onProgress(i + 1, files.length);
      }

      try {
        const uploaded = await this.uploadFile(file, itemId);
        results.push(uploaded);
      } catch (error) {
        console.error(`[B2] Failed to upload ${file.name}:`, error);
      }
    }

    return results;
  }

  static async deleteAssetGroup(assetGroupId: string): Promise<void> {
    try {
      console.log('[B2] Requesting deletion of asset group from worker:', assetGroupId);

      const workerUrl = import.meta.env.VITE_WORKER_URL;
      if (!workerUrl) {
        throw new Error('Worker URL not configured');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(`${workerUrl}/api/delete-asset-group`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ assetGroupId }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[B2] Deletion failed:', errorText);
        throw new Error(`Deletion failed: ${errorText}`);
      }

      const result = await response.json();
      console.log('[B2] Asset group deleted successfully:', result);
    } catch (error) {
      console.error('[B2] Failed to delete asset group:', error);
      throw error;
    }
  }

  static async deleteFile(filePath: string): Promise<void> {
    console.log('[B2] File deletion not implemented (files remain in B2):', filePath);
  }

  static async deleteFiles(filePaths: string[]): Promise<void> {
    console.log('[B2] Batch file deletion not implemented (files remain in B2):', filePaths);
  }

  static getPublicUrl(filePath: string): string {
    const cdnBaseUrl = import.meta.env.VITE_CDN_BASE_URL;
    return `${cdnBaseUrl}/${filePath}`;
  }

  static async restoreFileGroup(assetGroupId: string): Promise<void> {
    try {
      console.log('[Storage] Restoring file group:', assetGroupId);

      const { error } = await supabase
        .from('auction_files')
        .update({ detached_at: null })
        .eq('asset_group_id', assetGroupId);

      if (error) throw error;

      console.log('[Storage] File group restored successfully');
    } catch (error) {
      console.error('[Storage] Failed to restore file group:', error);
      throw error;
    }
  }

  static async permanentlyDeleteFileGroup(assetGroupId: string): Promise<void> {
    try {
      console.log('[Storage] Permanently deleting file group:', assetGroupId);

      const { error } = await supabase
        .from('auction_files')
        .delete()
        .eq('asset_group_id', assetGroupId);

      if (error) throw error;

      console.log('[Storage] File group deleted. B2 cleanup will occur automatically via cleanup jobs.');
    } catch (error) {
      console.error('[Storage] Failed to delete file group:', error);
      throw error;
    }
  }
}
