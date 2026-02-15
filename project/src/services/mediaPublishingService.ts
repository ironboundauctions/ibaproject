import { supabase } from '../lib/supabase';

export interface MediaFile {
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
  detached_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublishJob {
  id: string;
  file_id: string;
  asset_group_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority: number;
  retry_count: number;
  max_retries: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttachMediaParams {
  source_key: string;
  original_name: string;
  mime_type?: string;
  bytes?: number;
  item_id?: string;
  priority?: number;
}

export interface MediaStatusResponse {
  files: MediaFile[];
  jobs: PublishJob[];
}

class MediaPublishingService {
  async attachMedia(params: AttachMediaParams): Promise<{ file: MediaFile; job: PublishJob }> {
    const asset_group_id = crypto.randomUUID();

    const sourceFileData = {
      asset_group_id,
      variant: 'source',
      source_key: params.source_key,
      original_name: params.original_name,
      mime_type: params.mime_type || null,
      bytes: params.bytes || null,
      item_id: params.item_id || null,
      published_status: 'pending',
    };

    const { data: sourceFile, error: insertError } = await supabase
      .from('auction_files')
      .insert(sourceFileData)
      .select()
      .single();

    if (insertError || !sourceFile) {
      throw new Error(insertError?.message || 'Failed to insert source file');
    }

    const { data: job, error: jobError } = await supabase
      .from('publish_jobs')
      .select()
      .eq('file_id', sourceFile.id)
      .single();

    if (jobError || !job) {
      throw new Error(jobError?.message || 'Failed to retrieve publish job');
    }

    return { file: sourceFile as MediaFile, job: job as PublishJob };
  }

  async detachMedia(asset_group_id: string): Promise<void> {
    const { error } = await supabase
      .from('auction_files')
      .update({ detached_at: new Date().toISOString() })
      .eq('asset_group_id', asset_group_id);

    if (error) {
      throw new Error(error.message || 'Failed to detach media');
    }
  }

  async getMediaStatus(params: {
    file_id?: string;
    asset_group_id?: string;
    item_id?: string;
  }): Promise<MediaStatusResponse> {
    let filesQuery = supabase
      .from('auction_files')
      .select('*')
      .is('detached_at', null);

    if (params.file_id) {
      filesQuery = filesQuery.eq('id', params.file_id);
    }
    if (params.asset_group_id) {
      filesQuery = filesQuery.eq('asset_group_id', params.asset_group_id);
    }
    if (params.item_id) {
      filesQuery = filesQuery.eq('item_id', params.item_id);
    }

    const { data: files, error: filesError } = await filesQuery;

    if (filesError) {
      throw new Error(filesError.message || 'Failed to get media files');
    }

    const assetGroupIds = files?.map(f => f.asset_group_id) || [];

    let jobs: PublishJob[] = [];
    if (assetGroupIds.length > 0) {
      const { data: jobsData, error: jobsError } = await supabase
        .from('publish_jobs')
        .select('*')
        .in('asset_group_id', assetGroupIds);

      if (jobsError) {
        throw new Error(jobsError.message || 'Failed to get publish jobs');
      }

      jobs = jobsData as PublishJob[];
    }

    return {
      files: (files || []) as MediaFile[],
      jobs,
    };
  }

  async getMediaByItem(item_id: string): Promise<MediaFile[]> {
    const { data, error } = await supabase
      .from('auction_files')
      .select('*')
      .eq('item_id', item_id)
      .is('detached_at', null)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(error.message || 'Failed to get media files');
    }

    return (data || []) as MediaFile[];
  }

  async getPublishedVariants(asset_group_id: string): Promise<MediaFile[]> {
    const { data, error } = await supabase
      .from('auction_files')
      .select('*')
      .eq('asset_group_id', asset_group_id)
      .eq('published_status', 'published')
      .is('detached_at', null);

    if (error) {
      throw new Error(error.message || 'Failed to get published variants');
    }

    return (data || []) as MediaFile[];
  }

  getCdnUrl(b2_key: string): string {
    const cdnBase = import.meta.env.VITE_CDN_BASE_URL || 'https://cdn.ibaproject.bid/file/IBA-Lot-Media';
    return `${cdnBase}/${b2_key}`;
  }
}

export const mediaPublishingService = new MediaPublishingService();
