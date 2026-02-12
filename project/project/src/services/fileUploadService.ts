import { supabase } from '../lib/supabase';

export interface FileUploadRecord {
  id: string;
  filename: string;
  file_url: string;
  inventory_number: string | null;
  file_type: string;
  file_size: number | null;
  uploaded_by: string | null;
  uploaded_at: string;
  metadata: Record<string, any>;
}

export class FileUploadService {
  static async getUploadsByInventoryNumber(inventoryNumber: string): Promise<FileUploadRecord[]> {
    try {
      const { data, error } = await supabase
        .from('file_uploads')
        .select('*')
        .eq('inventory_number', inventoryNumber)
        .order('uploaded_at', { ascending: false });

      if (error) {
        console.error('Error fetching uploads:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching uploads:', error);
      return [];
    }
  }

  static async getUploadsByUser(userId: string): Promise<FileUploadRecord[]> {
    try {
      const { data, error } = await supabase
        .from('file_uploads')
        .select('*')
        .eq('uploaded_by', userId)
        .order('uploaded_at', { ascending: false });

      if (error) {
        console.error('Error fetching uploads:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching uploads:', error);
      return [];
    }
  }

  static async getAllUploads(limit: number = 100): Promise<FileUploadRecord[]> {
    try {
      const { data, error } = await supabase
        .from('file_uploads')
        .select('*')
        .order('uploaded_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching uploads:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching uploads:', error);
      return [];
    }
  }

  static async deleteUpload(uploadId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('file_uploads')
        .delete()
        .eq('id', uploadId);

      if (error) {
        console.error('Error deleting upload:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error deleting upload:', error);
      return false;
    }
  }

  static async getUploadStats(): Promise<{
    totalUploads: number;
    totalSize: number;
    uploadsByType: Record<string, number>;
  }> {
    try {
      const { data, error } = await supabase
        .from('file_uploads')
        .select('file_type, file_size');

      if (error) {
        console.error('Error fetching upload stats:', error);
        return {
          totalUploads: 0,
          totalSize: 0,
          uploadsByType: {}
        };
      }

      const totalUploads = data?.length || 0;
      const totalSize = data?.reduce((sum, upload) => sum + (upload.file_size || 0), 0) || 0;
      const uploadsByType: Record<string, number> = {};

      data?.forEach(upload => {
        if (upload.file_type) {
          uploadsByType[upload.file_type] = (uploadsByType[upload.file_type] || 0) + 1;
        }
      });

      return {
        totalUploads,
        totalSize,
        uploadsByType
      };
    } catch (error) {
      console.error('Error fetching upload stats:', error);
      return {
        totalUploads: 0,
        totalSize: 0,
        uploadsByType: {}
      };
    }
  }
}
