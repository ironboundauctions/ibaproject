import { supabase } from '../lib/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function callStreamFunction(method: string, action: string, body?: object, params?: Record<string, string>) {
  const { data: { session } } = await supabase!.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const url = new URL(`${SUPABASE_URL}/functions/v1/cloudflare-stream`);
  url.searchParams.set('action', action);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    method,
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Stream API error: ${res.status}`);
  }

  return res.json();
}

export interface StreamInfo {
  uid: string;
  whipUrl: string;
  playbackUrl: string;
  whepUrl: string;
}

export interface StreamStatus {
  uid: string;
  status: 'idle' | 'connected' | 'disconnected' | 'error';
  videoId: string | null;
}

export class CloudflareStreamService {
  static async createStream(eventId: string, eventName: string): Promise<StreamInfo> {
    return callStreamFunction('POST', 'create', { eventId, eventName });
  }

  static async getStreamStatus(uid: string): Promise<StreamStatus> {
    return callStreamFunction('GET', 'status', undefined, { uid });
  }

  static async deleteStream(uid: string): Promise<void> {
    await callStreamFunction('DELETE', 'delete', undefined, { uid });
  }
}
