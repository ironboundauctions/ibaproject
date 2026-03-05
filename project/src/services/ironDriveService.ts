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

export class IronDriveService {
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
