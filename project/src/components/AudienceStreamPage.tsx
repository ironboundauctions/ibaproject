import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { LiveAuctionSession } from '../services/liveClerkService';
import { Wifi, WifiOff, Video, Loader, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';

export default function AudienceStreamPage() {
  const eventId = (() => {
    const match = window.location.pathname.match(/\/stream\/([^/]+)/);
    return match ? match[1] : null;
  })();

  const [session, setSession] = useState<LiveAuctionSession | null>(null);
  const [eventTitle, setEventTitle] = useState('');
  const [streamState, setStreamState] = useState<'loading' | 'no-stream' | 'buffering' | 'live' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!eventId) return;
    loadSession();
  }, [eventId]);

  // Subscribe to session changes via Supabase realtime
  useEffect(() => {
    if (!eventId) return;
    const channel = supabase!
      .channel(`stream_viewer_${eventId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'live_auction_sessions',
        filter: `event_id=eq.${eventId}`,
      }, (payload) => {
        const updated = payload.new as LiveAuctionSession;
        setSession(updated);
        if (updated.cf_stream_playback_url && !updated.cf_stream_uid) {
          // stream was removed
          teardownHls();
          setStreamState('no-stream');
        } else if (updated.cf_stream_playback_url && streamState === 'no-stream') {
          startHls(updated.cf_stream_playback_url);
        }
      })
      .subscribe();

    return () => { supabase?.removeChannel(channel); };
  }, [eventId, streamState]);

  const loadSession = async () => {
    try {
      const [eventRes, sessionRes] = await Promise.all([
        supabase!.from('auction_events').select('title').eq('id', eventId!).maybeSingle(),
        supabase!.from('live_auction_sessions').select('*').eq('event_id', eventId!).neq('status', 'ended').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);

      if (eventRes.data) setEventTitle(eventRes.data.title);

      const sess = sessionRes.data as LiveAuctionSession | null;
      setSession(sess);

      if (sess?.cf_stream_playback_url) {
        startHls(sess.cf_stream_playback_url);
      } else {
        setStreamState('no-stream');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load stream');
      setStreamState('error');
    }
  };

  const startHls = async (playbackUrl: string) => {
    setStreamState('buffering');

    const video = videoRef.current;
    if (!video) return;

    teardownHls();

    // Native HLS (Safari/iOS)
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = playbackUrl;
      video.load();
      video.play().catch(() => {});
      video.addEventListener('playing', () => setStreamState('live'), { once: true });
      video.addEventListener('error', () => scheduleRetry(playbackUrl), { once: true });
      return;
    }

    // hls.js for Chrome/Firefox
    try {
      const HlsModule = await import('https://cdn.jsdelivr.net/npm/hls.js@1.5.13/dist/hls.esm.min.js' as any);
      const Hls = HlsModule.default;

      if (!Hls.isSupported()) {
        setErrorMsg('HLS playback not supported in this browser.');
        setStreamState('error');
        return;
      }

      const hls = new Hls({
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 10,
        lowLatencyMode: true,
      });

      hlsRef.current = hls;
      hls.loadSource(playbackUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });

      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        video.addEventListener('playing', () => setStreamState('live'), { once: true });
      });

      hls.on(Hls.Events.ERROR, (_: any, data: any) => {
        if (data.fatal) {
          hls.destroy();
          scheduleRetry(playbackUrl);
        }
      });
    } catch {
      setErrorMsg('Failed to load HLS player.');
      setStreamState('error');
    }
  };

  const teardownHls = () => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (retryRef.current) {
      clearTimeout(retryRef.current);
      retryRef.current = null;
    }
    const video = videoRef.current;
    if (video) {
      video.src = '';
      video.load();
    }
  };

  const scheduleRetry = (url: string) => {
    setStreamState('buffering');
    retryRef.current = setTimeout(() => startHls(url), 5000);
  };

  useEffect(() => {
    return () => teardownHls();
  }, []);

  const currentBid = session?.current_bid ?? 0;
  const askingPrice = session?.asking_price ?? 0;
  const sessionStatus = session?.status ?? 'idle';

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header bar */}
      <div className="flex-shrink-0 bg-ironbound-grey-900 border-b border-ironbound-grey-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/ironbound_primarylogog.png" alt="IronBound" className="h-7 object-contain" />
          <div>
            <h1 className="text-white text-sm font-bold leading-tight">{eventTitle || 'Live Auction'}</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              {sessionStatus === 'running' ? (
                <>
                  <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span></span>
                  <span className="text-red-400 text-xs font-semibold uppercase tracking-wider">Live</span>
                </>
              ) : sessionStatus === 'paused' ? (
                <span className="text-yellow-400 text-xs font-semibold uppercase tracking-wider">Paused</span>
              ) : sessionStatus === 'ended' ? (
                <span className="text-ironbound-grey-500 text-xs font-semibold uppercase tracking-wider">Ended</span>
              ) : (
                <span className="text-ironbound-grey-500 text-xs font-semibold uppercase tracking-wider">Starting Soon</span>
              )}
            </div>
          </div>
        </div>

        {/* Connection status */}
        <div className="flex items-center gap-2">
          {streamState === 'live' ? (
            <span className="flex items-center gap-1.5 text-xs text-green-400"><Wifi className="h-3.5 w-3.5" /> Connected</span>
          ) : streamState === 'buffering' ? (
            <span className="flex items-center gap-1.5 text-xs text-yellow-400"><Loader className="h-3.5 w-3.5 animate-spin" /> Connecting...</span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-ironbound-grey-500"><WifiOff className="h-3.5 w-3.5" /> No stream</span>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Video area */}
        <div className="flex-1 relative bg-black flex items-center justify-center min-h-[240px]">
          <video
            ref={videoRef}
            className={`w-full h-full object-contain max-h-[calc(100vh-200px)] ${streamState !== 'live' ? 'opacity-0' : 'opacity-100'} transition-opacity duration-500`}
            autoPlay
            playsInline
            controls={streamState === 'live'}
          />

          {streamState !== 'live' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {streamState === 'loading' && (
                <div className="text-center">
                  <Loader className="h-10 w-10 text-ironbound-orange-500 animate-spin mx-auto mb-3" />
                  <p className="text-ironbound-grey-400 text-sm">Loading stream...</p>
                </div>
              )}
              {streamState === 'buffering' && (
                <div className="text-center">
                  <Loader className="h-10 w-10 text-ironbound-orange-500 animate-spin mx-auto mb-3" />
                  <p className="text-white text-sm font-semibold mb-1">Stream is starting...</p>
                  <p className="text-ironbound-grey-400 text-xs">This may take 10–30 seconds after broadcast begins</p>
                </div>
              )}
              {streamState === 'no-stream' && (
                <div className="text-center px-6">
                  <Video className="h-16 w-16 text-ironbound-grey-700 mx-auto mb-4" />
                  <p className="text-white text-base font-semibold mb-2">Stream not started yet</p>
                  <p className="text-ironbound-grey-400 text-sm">The auctioneer will start the stream shortly.<br />This page will update automatically.</p>
                </div>
              )}
              {streamState === 'error' && (
                <div className="text-center px-6">
                  <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-3" />
                  <p className="text-white text-sm font-semibold mb-1">Playback error</p>
                  <p className="text-ironbound-grey-400 text-xs mb-4">{errorMsg}</p>
                  <button
                    onClick={() => session?.cf_stream_playback_url && startHls(session.cf_stream_playback_url)}
                    className="px-4 py-2 bg-ironbound-orange-500 hover:bg-ironbound-orange-600 text-white text-sm rounded-lg transition-colors"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bid info sidebar */}
        {session && sessionStatus !== 'idle' && (
          <div className="flex-shrink-0 lg:w-64 bg-ironbound-grey-900 border-t lg:border-t-0 lg:border-l border-ironbound-grey-800 p-4 flex flex-col gap-4">
            <div>
              <p className="text-ironbound-grey-500 text-xs uppercase tracking-wider mb-1">Current Bid</p>
              <p className="text-white text-3xl font-bold">{formatCurrency(currentBid)}</p>
            </div>
            {askingPrice > currentBid && (
              <div>
                <p className="text-ironbound-grey-500 text-xs uppercase tracking-wider mb-1">Asking</p>
                <p className="text-ironbound-orange-400 text-2xl font-bold">{formatCurrency(askingPrice)}</p>
              </div>
            )}
            {session.projector_message && (
              <div className="bg-ironbound-grey-800 rounded-lg px-3 py-2">
                <p className="text-yellow-300 text-sm font-semibold text-center">{session.projector_message}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
