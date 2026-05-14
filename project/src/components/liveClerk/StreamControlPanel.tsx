import React, { useState, useEffect, useRef } from 'react';
import { Video, VideoOff, Wifi, WifiOff, Copy, Check, ExternalLink, RefreshCw, Loader } from 'lucide-react';
import { CloudflareStreamService } from '../../services/cloudflareStreamService';
import { LiveAuctionSession } from '../../services/liveClerkService';
import { supabase } from '../../lib/supabase';

interface Props {
  session: LiveAuctionSession;
  eventId: string;
  eventName: string;
  onSessionUpdate: (updated: LiveAuctionSession) => void;
}

type StreamState = 'none' | 'creating' | 'ready' | 'live' | 'deleting';

export default function StreamControlPanel({ session, eventId, eventName, onSessionUpdate }: Props) {
  const [streamState, setStreamState] = useState<StreamState>(session.cf_stream_uid ? 'ready' : 'none');
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<string>(session.cf_stream_status || 'idle');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (session.cf_stream_uid) {
      setStreamState('ready');
      setLiveStatus(session.cf_stream_status || 'idle');
    } else {
      setStreamState('none');
    }
  }, [session.cf_stream_uid, session.cf_stream_status]);

  // Poll stream status when a stream exists
  useEffect(() => {
    if (!session.cf_stream_uid) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }

    const poll = async () => {
      try {
        const status = await CloudflareStreamService.getStreamStatus(session.cf_stream_uid!);
        const newStatus = status.status;
        setLiveStatus(newStatus);
        if (newStatus === 'connected') setStreamState('live');
        else if (streamState === 'live' && newStatus !== 'connected') setStreamState('ready');

        // Sync status back to DB if changed
        if (newStatus !== session.cf_stream_status) {
          const { data } = await supabase!
            .from('live_auction_sessions')
            .update({ cf_stream_status: newStatus, updated_at: new Date().toISOString() })
            .eq('id', session.id)
            .select()
            .single();
          if (data) onSessionUpdate(data as LiveAuctionSession);
        }
      } catch {}
    };

    poll();
    pollRef.current = setInterval(poll, 8000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [session.cf_stream_uid, session.id]);

  const handleCreate = async () => {
    setStreamState('creating');
    setError(null);
    try {
      const info = await CloudflareStreamService.createStream(eventId, eventName);
      // Fetch updated session
      const { data } = await supabase!
        .from('live_auction_sessions')
        .select('*')
        .eq('id', session.id)
        .single();
      if (data) onSessionUpdate(data as LiveAuctionSession);
      setStreamState('ready');
    } catch (err: any) {
      setError(err.message || 'Failed to create stream');
      setStreamState('none');
    }
  };

  const handleDelete = async () => {
    if (!session.cf_stream_uid) return;
    if (!window.confirm('Delete this stream? The stream will stop and cannot be recovered.')) return;
    setStreamState('deleting');
    setError(null);
    try {
      await CloudflareStreamService.deleteStream(session.cf_stream_uid);
      const { data } = await supabase!
        .from('live_auction_sessions')
        .update({ cf_stream_uid: null, cf_stream_whip_url: null, cf_stream_playback_url: null, cf_stream_status: 'idle', updated_at: new Date().toISOString() })
        .eq('id', session.id)
        .select()
        .single();
      if (data) onSessionUpdate(data as LiveAuctionSession);
      setStreamState('none');
    } catch (err: any) {
      setError(err.message || 'Failed to delete stream');
      setStreamState('ready');
    }
  };

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {}
  };

  const openBroadcaster = () => {
    window.open(`/broadcast/${eventId}`, '_blank', 'noopener,noreferrer');
  };

  const openViewer = () => {
    window.open(`/stream/${eventId}`, '_blank', 'noopener,noreferrer');
  };

  const statusDot = () => {
    if (streamState === 'live' || liveStatus === 'connected') {
      return <span className="relative flex h-2 w-2 flex-shrink-0"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span>;
    }
    if (streamState === 'ready') {
      return <span className="h-2 w-2 rounded-full bg-yellow-500 flex-shrink-0" />;
    }
    return <span className="h-2 w-2 rounded-full bg-ironbound-grey-600 flex-shrink-0" />;
  };

  return (
    <div className="bg-ironbound-grey-700/50 rounded-lg p-2.5 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Video className="h-3.5 w-3.5 text-ironbound-orange-400 flex-shrink-0" />
          <span className="text-xs font-semibold text-ironbound-grey-300 uppercase tracking-wider">Live Stream</span>
        </div>
        <div className="flex items-center gap-1.5">
          {statusDot()}
          <span className="text-xs text-ironbound-grey-400">
            {streamState === 'none' && 'No stream'}
            {streamState === 'creating' && 'Creating...'}
            {streamState === 'deleting' && 'Deleting...'}
            {streamState === 'ready' && liveStatus !== 'connected' && 'Ready'}
            {(streamState === 'live' || liveStatus === 'connected') && 'LIVE'}
          </span>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-900/30 border border-red-800 rounded px-2 py-1">{error}</p>
      )}

      {streamState === 'none' && (
        <button
          onClick={handleCreate}
          className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 bg-ironbound-orange-500 hover:bg-ironbound-orange-600 text-white text-xs font-semibold rounded transition-colors"
        >
          <Video className="h-3.5 w-3.5" />
          Create Stream
        </button>
      )}

      {(streamState === 'creating' || streamState === 'deleting') && (
        <div className="flex items-center justify-center gap-2 py-1.5">
          <Loader className="h-3.5 w-3.5 text-ironbound-orange-400 animate-spin" />
          <span className="text-xs text-ironbound-grey-400">{streamState === 'creating' ? 'Setting up stream...' : 'Removing stream...'}</span>
        </div>
      )}

      {(streamState === 'ready' || streamState === 'live') && session.cf_stream_uid && (
        <div className="space-y-1.5">
          {/* WHIP URL for OBS/broadcaster */}
          {session.cf_stream_whip_url && (
            <div className="bg-ironbound-grey-800 rounded px-2 py-1.5">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[10px] text-ironbound-grey-500 uppercase tracking-wider">WHIP (Broadcast)</span>
                <button
                  onClick={() => copyToClipboard(session.cf_stream_whip_url!, 'whip')}
                  className="text-ironbound-grey-400 hover:text-white transition-colors"
                  title="Copy WHIP URL"
                >
                  {copiedKey === 'whip' ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
              <p className="text-[10px] text-ironbound-grey-400 font-mono truncate">{session.cf_stream_whip_url}</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-1">
            <button
              onClick={openBroadcaster}
              className="flex items-center justify-center gap-1 px-2 py-1.5 bg-ironbound-grey-600 hover:bg-ironbound-grey-500 text-white text-xs rounded transition-colors"
              title="Open browser broadcaster"
            >
              <Wifi className="h-3 w-3" />
              Broadcast
            </button>
            <button
              onClick={openViewer}
              className="flex items-center justify-center gap-1 px-2 py-1.5 bg-ironbound-grey-600 hover:bg-ironbound-grey-500 text-white text-xs rounded transition-colors"
              title="Open audience viewer"
            >
              <ExternalLink className="h-3 w-3" />
              Viewer
            </button>
          </div>

          <button
            onClick={handleDelete}
            className="w-full flex items-center justify-center gap-1 px-2 py-1 text-red-400 hover:text-red-300 text-[10px] transition-colors"
          >
            <VideoOff className="h-3 w-3" />
            Remove Stream
          </button>
        </div>
      )}
    </div>
  );
}
