import { supabase } from '../lib/supabase';

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
        id: crypto.randomUUID(),
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
}
