import { supabase } from '../lib/supabase';

export interface MediaFile {
  id: string;
  file_key: string;
  file_name: string;
  file_type: string;
  thumb_url: string | null;
  display_url: string | null;
  publish_status: string;
  published_at: string | null;
  deleted_at: string | null;
  cdn_key_prefix: string | null;
  lot_id: string | null;
  auction_id: string | null;
  job?: {
    file_id: string;
    status: string;
    retry_count: number;
    error_message: string | null;
    started_at: string | null;
    completed_at: string | null;
  } | null;
}

export interface AttachMediaParams {
  file_key: string;
  file_name: string;
  file_type: string;
  lot_id?: string;
  auction_id?: string;
  priority?: number;
}

export interface MediaStatusResponse {
  files: MediaFile[];
}

class MediaPublishingService {
  private getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Not authenticated');
    }

    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    };
  };

  async attachMedia(params: AttachMediaParams): Promise<{ file: MediaFile; job: any }> {
    const headers = await this.getAuthHeaders();
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lot-media-attach`;

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to attach media');
    }

    return response.json();
  }

  async detachMedia(fileId: string): Promise<void> {
    const headers = await this.getAuthHeaders();
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lot-media-detach`;

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ file_id: fileId }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to detach media');
    }
  }

  async getMediaStatus(params: {
    file_id?: string;
    lot_id?: string;
    auction_id?: string;
  }): Promise<MediaStatusResponse> {
    const url = new URL(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lot-media-status`);

    if (params.file_id) url.searchParams.set('file_id', params.file_id);
    if (params.lot_id) url.searchParams.set('lot_id', params.lot_id);
    if (params.auction_id) url.searchParams.set('auction_id', params.auction_id);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get media status');
    }

    return response.json();
  }
}

export const mediaPublishingService = new MediaPublishingService();
