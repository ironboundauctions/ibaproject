import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Radio, Volume2, VolumeX, Gavel, AlertCircle, Lock,
  ArrowLeft, Wifi, WifiOff, ChevronLeft, ChevronRight, Video,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { LiveClerkService, LiveAuctionSession, OnlineBid } from '../services/liveClerkService';
import { InventoryService } from '../services/inventoryService';
import { formatCurrency } from '../utils/formatters';
import { useAuth } from '../hooks/useAuth';

interface Props {
  eventId: string;
  onBack: () => void;
  onAuthRequired: () => void;
}

interface LotInfo {
  id: string;
  title: string;
  description?: string | null;
  images: string[];
  lot_number?: string | null;
}

export default function LiveBiddingPage({ eventId, onBack, onAuthRequired }: Props) {
  const { user } = useAuth();
  const [session, setSession] = useState<LiveAuctionSession | null>(null);
  const [eventTitle, setEventTitle] = useState('');
  const [currentLot, setCurrentLot] = useState<LotInfo | null>(null);
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [streamMuted, setStreamMuted] = useState(true);
  const [bidding, setBidding] = useState(false);
  const [bidStatus, setBidStatus] = useState<'idle' | 'pending' | 'accepted' | 'rejected' | 'superseded'>('idle');
  const [bidStatusMsg, setBidStatusMsg] = useState('');
  const [pendingBidLotIndex, setPendingBidLotIndex] = useState<number | null>(null);
  const [imageIndexOverride, setImageIndexOverride] = useState<number | null>(null);
  const [bidderName, setBidderName] = useState('');
  const [myBidId, setMyBidId] = useState<string | null>(null);
  const [hasEverBidOnLot, setHasEverBidOnLot] = useState(false);
  const [outbid, setOutbid] = useState(false);

  const streamVideoRef = useRef<HTMLVideoElement>(null);
  const itemVideoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);
  const sessionRef = useRef<LiveAuctionSession | null>(null);
  sessionRef.current = session;

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: profile } = await supabase!
        .from('user_profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();
      setBidderName(profile?.full_name || user.email?.split('@')[0] || 'Online Bidder');
    })();
  }, [user]);

  const loadLotInfo = useCallback(async (sess: LiveAuctionSession) => {
    if (!sess.current_lot_id) { setCurrentLot(null); setCurrentVideoUrl(null); return; }
    try {
      const { data } = await supabase!
        .from('inventory_items')
        .select('id, title, description')
        .eq('id', sess.current_lot_id)
        .maybeSingle();
      if (!data) { setCurrentLot(null); setCurrentVideoUrl(null); return; }

      // Fetch lot_number from the event assignment (that's where the clerk assigns it)
      const { data: assignment } = await supabase!
        .from('event_inventory_assignments')
        .select('lot_number')
        .eq('event_id', sess.event_id)
        .eq('inventory_id', sess.current_lot_id)
        .maybeSingle();

      const imagesMap = await InventoryService.getBestQualityImagesForItems([data.id]);
      setCurrentLot({ ...data, lot_number: assignment?.lot_number ?? null, images: imagesMap[data.id] ?? [] });
      setImageIndexOverride(null);

      // Load published video from auction_files (same source as projector)
      const { data: fileData } = await supabase!
        .from('auction_files')
        .select('cdn_url')
        .eq('item_id', data.id)
        .eq('variant', 'video')
        .eq('published_status', 'published')
        .is('detached_at', null)
        .not('cdn_url', 'is', null)
        .limit(1)
        .maybeSingle();
      setCurrentVideoUrl(fileData?.cdn_url ?? null);
    } catch {
      setCurrentLot(null);
      setCurrentVideoUrl(null);
    }
  }, []);

  // Restart item video when lot changes
  useEffect(() => {
    if (itemVideoRef.current) itemVideoRef.current.load();
  }, [currentVideoUrl]);

  // Disable Media Session API actions so browser never shows next/prev track buttons
  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('nexttrack', null);
      navigator.mediaSession.setActionHandler('previoustrack', null);
      navigator.mediaSession.setActionHandler('seekforward', null);
      navigator.mediaSession.setActionHandler('seekbackward', null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const { data: eventData } = await supabase!
          .from('auction_events')
          .select('title')
          .eq('id', eventId)
          .maybeSingle();
        if (!cancelled) setEventTitle(eventData?.title || 'Live Auction');
        const sess = await LiveClerkService.getOrCreateSession(eventId);
        if (!cancelled) { setSession(sess); await loadLotInfo(sess); }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load auction');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [eventId, loadLotInfo]);

  // Primary: broadcast channel (same one clerk pushes to — instant updates)
  useEffect(() => {
    const channel = supabase!
      .channel(`projector_broadcast_${eventId}`)
      .on('broadcast', { event: 'session_update' }, async ({ payload }) => {
        const updated = payload as LiveAuctionSession;
        const prev = sessionRef.current;
        setSession(updated);
        if (updated.current_lot_id !== prev?.current_lot_id) {
          setBidStatus('idle');
          setMyBidId(null);
          setPendingBidLotIndex(null);
          setHasEverBidOnLot(false);
          setOutbid(false);
          await loadLotInfo(updated);
        }
      })
      .subscribe();
    return () => { supabase?.removeChannel(channel); };
  }, [eventId, loadLotInfo]);

  // Fallback: postgres_changes
  useEffect(() => {
    if (!session?.id) return;
    const sub = LiveClerkService.subscribeToSession(session.id, async (updated) => {
      const prev = sessionRef.current;
      setSession(updated);
      if (updated.current_lot_id !== prev?.current_lot_id) {
        setBidStatus('idle');
        setMyBidId(null);
        setPendingBidLotIndex(null);
        setHasEverBidOnLot(false);
        setOutbid(false);
        await loadLotInfo(updated);
      }
      if (pendingBidLotIndex !== null && updated.current_lot_index !== pendingBidLotIndex) {
        setBidStatus('idle');
        setPendingBidLotIndex(null);
        setMyBidId(null);
      }
    });
    return () => { supabase?.removeChannel(sub); };
  }, [session?.id, loadLotInfo, pendingBidLotIndex]);

  useEffect(() => {
    if (!session?.id || !myBidId) return;
    const sub = supabase!
      .channel(`my_bid_${myBidId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'online_bids',
        filter: `id=eq.${myBidId}`,
      }, (payload) => {
        const updated = payload.new as OnlineBid;
        if (updated.status === 'accepted') {
          setBidStatus('accepted');
          setBidStatusMsg('Your bid was accepted!');
          setBidding(false);
        } else if (updated.status === 'rejected') {
          setBidStatus('rejected');
          setBidStatusMsg('Bid was not accepted.');
          setBidding(false);
          setPendingBidLotIndex(null);
          setMyBidId(null);
        } else if (updated.status === 'superseded') {
          setBidStatus('superseded');
          setBidStatusMsg('Bidding has moved on.');
          setBidding(false);
          setPendingBidLotIndex(null);
          setMyBidId(null);
        }
      })
      .subscribe();
    return () => { supabase?.removeChannel(sub); };
  }, [session?.id, myBidId]);

  // HLS stream
  useEffect(() => {
    const playbackUrl = session?.cf_stream_playback_url;
    const isLive = session?.cf_stream_status === 'connected';
    if (!playbackUrl || !isLive || !streamVideoRef.current) {
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
      return;
    }
    const video = streamVideoRef.current;
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = playbackUrl;
      video.muted = streamMuted;
      video.play().catch(() => {});
      return;
    }
    import('https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js' as any).catch(() => null).then((module: any) => {
      const Hls = module?.default ?? (window as any).Hls;
      if (!Hls || !Hls.isSupported()) return;
      if (hlsRef.current) hlsRef.current.destroy();
      const hls = new Hls({ lowLatencyMode: true });
      hls.loadSource(playbackUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.muted = streamMuted;
        video.play().catch(() => {});
      });
      hlsRef.current = hls;
    });
    return () => { if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; } };
  }, [session?.cf_stream_playback_url, session?.cf_stream_status]);

  useEffect(() => {
    if (streamVideoRef.current) streamVideoRef.current.muted = streamMuted;
  }, [streamMuted]);

  const handleBid = async () => {
    if (!session || !user || bidStatus === 'pending' || session.status !== 'running') return;
    if (!session.asking_price) return;
    setBidding(true);
    setBidStatus('pending');
    setBidStatusMsg('Placing bid...');
    setPendingBidLotIndex(session.current_lot_index);
    setHasEverBidOnLot(true);
    setOutbid(false);
    try {
      const bid = await LiveClerkService.submitOnlineBid(
        session.id, eventId, session.current_lot_id, session.current_lot_index,
        user.id, bidderName, session.asking_price
      );
      setMyBidId(bid.id);
      setBidStatusMsg('Bid submitted — waiting for clerk...');
    } catch (err: any) {
      setBidStatus('rejected');
      setBidStatusMsg(err.message || 'Failed to submit bid');
      setBidding(false);
      setPendingBidLotIndex(null);
    }
  };

  const streamIsLive = !!(session?.cf_stream_uid && session?.cf_stream_status === 'connected');
  const auctionRunning = session?.status === 'running';
  const isHighBidder = !!user && session?.current_high_bidder_id === user.id;
  const canBid = auctionRunning && !!user && bidStatus !== 'pending' && !!session?.asking_price && !isHighBidder;

  const prevIsHighBidderRef = useRef(false);

  useEffect(() => {
    const was = prevIsHighBidderRef.current;
    prevIsHighBidderRef.current = isHighBidder;

    if (isHighBidder) {
      // Our bid was accepted — clear pending state so the green panel shows
      if (bidStatus === 'pending' || bidStatus === 'accepted') {
        setBidStatus('idle');
        setMyBidId(null);
        setPendingBidLotIndex(null);
      }
      setOutbid(false);
    } else {
      // Lost high bidder status
      if (bidStatus === 'accepted') {
        setBidStatus('idle');
        setMyBidId(null);
        setPendingBidLotIndex(null);
      }
      // Show outbid message only if we previously held the high bid on this lot
      if (was && hasEverBidOnLot) {
        setOutbid(true);
      }
    }
  }, [isHighBidder]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasPendingBid = bidStatus === 'pending' && !isHighBidder;
  const lotImages = currentLot?.images ?? [];
  // Clerk-synced image index; bidder can override temporarily
  const activeImageIndex = imageIndexOverride ?? (session?.projector_image_index ?? 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0e0e0e] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-ironbound-orange-500 mx-auto mb-3" />
          <p className="text-ironbound-grey-400 text-sm">Connecting to live auction...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0e0e0e] flex items-center justify-center">
        <div className="text-center max-w-sm">
          <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
          <p className="text-white font-semibold mb-1">Could not connect</p>
          <p className="text-ironbound-grey-400 text-sm mb-4">{error}</p>
          <button onClick={onBack} className="text-ironbound-orange-400 hover:underline text-sm">Back to Events</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-white flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 bg-[#141414] border-b border-white/8 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-ironbound-grey-400 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </button>
          <div className="w-px h-5 bg-white/10" />
          <div className="flex items-center gap-2">
            <Gavel className="h-4 w-4 text-ironbound-orange-400 flex-shrink-0" />
            <span className="text-sm font-semibold text-white truncate max-w-[180px] sm:max-w-xs">{eventTitle}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {auctionRunning ? (
            <span className="flex items-center gap-1.5 bg-green-600/20 border border-green-500/40 text-green-400 text-xs font-bold px-3 py-1.5 rounded-full">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400"></span>
              </span>
              LIVE
            </span>
          ) : session?.status === 'paused' ? (
            <span className="text-yellow-400 text-xs font-bold px-3 py-1.5 bg-yellow-900/30 rounded-full border border-yellow-700/40">PAUSED</span>
          ) : session?.status === 'ended' ? (
            <span className="text-ironbound-grey-400 text-xs font-bold px-3 py-1.5 bg-ironbound-grey-800 rounded-full">ENDED</span>
          ) : (
            <span className="text-ironbound-grey-500 text-xs px-3 py-1.5 bg-ironbound-grey-800/60 rounded-full">Waiting to start...</span>
          )}
          <div className="flex items-center gap-1.5 text-xs text-ironbound-grey-600">
            {auctionRunning
              ? <><Wifi className="h-3.5 w-3.5 text-green-600" /><span className="hidden sm:inline">Connected</span></>
              : <><WifiOff className="h-3.5 w-3.5" /><span className="hidden sm:inline">Not live</span></>
            }
          </div>
        </div>
      </header>

      <div className="flex-1 w-full max-w-4xl mx-auto px-4 py-5 flex flex-col gap-4">

        {/* Lot Number Banner */}
        <div className="bg-[#1a1a1a] border border-white/8 rounded-2xl px-6 py-5 text-center">
          <p className="text-xs text-ironbound-grey-400 uppercase tracking-widest font-semibold mb-2">Now Selling</p>
          {currentLot?.lot_number ? (
            <p className="text-5xl font-black text-ironbound-orange-400 tabular-nums leading-none mb-2">
              {currentLot.lot_number}
            </p>
          ) : (
            <p className="text-4xl font-bold text-ironbound-grey-600 leading-none mb-2">—</p>
          )}
          {currentLot?.title && (
            <p className="text-lg font-semibold text-white leading-snug">{currentLot.title}</p>
          )}
        </div>

        {/* Main grid: left col (image + bid) | right col (item video + stream camera) */}
        {(!currentLot && !auctionRunning) ? (
          <div className="bg-[#1a1a1a] rounded-2xl border border-white/8 p-10 text-center">
            <Gavel className="h-12 w-12 text-ironbound-grey-700 mx-auto mb-3" />
            <p className="text-ironbound-grey-400 font-semibold">
              {session?.status === 'ended' ? 'Auction has ended' : 'Auction has not started yet'}
            </p>
            <p className="text-ironbound-grey-600 text-sm mt-1">Check back when the auction goes live.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* LEFT COLUMN: Item image + title + current bid + bid button */}
            <div className="flex flex-col gap-3">

              {/* Item image — synced to clerk's projector_image_index; tap arrows to browse */}
              <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-[#1a1a1a] border border-white/8">
                {lotImages.length > 0 ? (
                  <>
                    <img
                      key={lotImages[activeImageIndex] ?? lotImages[0]}
                      src={lotImages[Math.min(activeImageIndex, lotImages.length - 1)] ?? lotImages[0]}
                      alt={currentLot?.title ?? ''}
                      className="w-full h-full object-cover transition-opacity duration-300"
                    />
                    {lotImages.length > 1 && (
                      <>
                        <button
                          onClick={() => setImageIndexOverride(i => Math.max(0, (i ?? activeImageIndex) - 1))}
                          disabled={activeImageIndex === 0}
                          className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 text-white disabled:opacity-20 hover:bg-black/80 transition-colors"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setImageIndexOverride(i => Math.min(lotImages.length - 1, (i ?? activeImageIndex) + 1))}
                          disabled={activeImageIndex >= lotImages.length - 1}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 text-white disabled:opacity-20 hover:bg-black/80 transition-colors"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-1.5">
                          {lotImages.map((_, i) => (
                            <button
                              key={i}
                              onClick={() => setImageIndexOverride(i)}
                              className={`h-1.5 w-1.5 rounded-full transition-colors ${i === activeImageIndex ? 'bg-white' : 'bg-white/35'}`}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Gavel className="h-10 w-10 text-ironbound-grey-700" />
                  </div>
                )}
              </div>

              {/* Current bid */}
              <div className="bg-[#1a1a1a] border border-white/8 rounded-xl px-5 py-4">
                <p className="text-ironbound-grey-300 text-sm font-semibold uppercase tracking-wide mb-1">Current Bid</p>
                <p className={`text-4xl font-black tabular-nums leading-none ${isHighBidder ? 'text-green-400' : 'text-white'}`}>
                  {session?.current_bid ? formatCurrency(session.current_bid) : '—'}
                </p>
              </div>

              {/* Bid button */}
              <div>
                {!user ? (
                  <button
                    onClick={onAuthRequired}
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-ironbound-grey-700 hover:bg-ironbound-grey-600 text-white font-semibold transition-colors"
                  >
                    <Lock className="h-4 w-4" />
                    Sign in to Bid
                  </button>
                ) : !auctionRunning ? (
                  <button
                    disabled
                    className="w-full py-4 rounded-xl bg-ironbound-grey-800 text-ironbound-grey-500 font-semibold cursor-not-allowed"
                  >
                    {session?.status === 'ended' ? 'Auction Ended' : 'Waiting for Auction...'}
                  </button>
                ) : hasPendingBid ? (
                  <div className="w-full py-4 rounded-xl bg-yellow-900/40 border border-yellow-700/50 text-yellow-300 font-semibold text-center text-sm">
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-yellow-300" />
                      Bid Submitted — Waiting for clerk...
                    </div>
                  </div>
                ) : isHighBidder ? (
                  <div className="w-full py-4 rounded-xl bg-green-800/60 border-2 border-green-500/70 text-green-300 font-bold text-center">
                    <div className="flex items-center justify-center gap-2.5">
                      <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-400"></span>
                      </span>
                      <span className="text-base">You are the High Bidder</span>
                    </div>
                    {session?.asking_price ? (
                      <p className="text-green-400 text-sm font-semibold mt-1">Next bid: {formatCurrency(session.asking_price)}</p>
                    ) : null}
                    <p className="text-green-500/70 text-xs font-normal mt-0.5">You cannot bid again while you hold the high bid</p>
                  </div>
                ) : (
                  <button
                    onClick={handleBid}
                    disabled={!canBid}
                    className={`w-full py-4 rounded-xl font-bold text-white transition-all text-lg ${
                      canBid
                        ? 'bg-ironbound-orange-500 hover:bg-ironbound-orange-600 active:scale-[0.98] shadow-lg shadow-ironbound-orange-900/40'
                        : 'bg-ironbound-grey-800 text-ironbound-grey-500 cursor-not-allowed'
                    }`}
                  >
                    {session?.asking_price
                      ? `Bid ${formatCurrency(session.asking_price)}`
                      : 'Waiting for asking price...'}
                  </button>
                )}

                {outbid && !isHighBidder && !hasPendingBid && (
                  <div className="mt-2.5 flex items-center justify-center gap-1.5 text-sm font-semibold text-red-400 animate-pulse">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-400 flex-shrink-0" />
                    You have been outbid — bid again!
                  </div>
                )}

              </div>

              {/* Item description */}
              {currentLot?.description && (
                <div className="bg-[#1a1a1a] border border-white/8 rounded-xl px-4 py-3">
                  <p className="text-xs text-ironbound-grey-500 uppercase tracking-widest font-semibold mb-1.5">Description</p>
                  <p className="text-ironbound-grey-300 text-sm leading-relaxed">{currentLot.description}</p>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: Item video (top) + Live stream camera (bottom) */}
            <div className="flex flex-col gap-4">

              {/* Item video — from auction_files (published), same source as projector */}
              <div className="w-full aspect-square rounded-2xl overflow-hidden bg-[#1a1a1a] border border-white/8 flex items-center justify-center relative">
                {currentVideoUrl ? (
                  <video
                    ref={itemVideoRef}
                    key={currentVideoUrl}
                    src={currentVideoUrl}
                    className="w-full h-full object-cover"
                    autoPlay
                    loop
                    muted
                    playsInline
                    disablePictureInPicture
                    controlsList="nodownload nofullscreen noremoteplayback noskip"
                  />
                ) : (
                  <div className="text-center">
                    <Video className="h-10 w-10 text-ironbound-grey-700 mx-auto mb-2" />
                    <p className="text-ironbound-grey-600 text-xs">No item video</p>
                  </div>
                )}
              </div>

              {/* Live stream camera */}
              <div className="w-full aspect-square rounded-2xl overflow-hidden bg-black border border-white/8 flex items-center justify-center relative">
                {streamIsLive ? (
                  <>
                    <video
                      ref={streamVideoRef}
                      className="w-full h-full object-cover"
                      playsInline
                      autoPlay
                      muted={streamMuted}
                    />
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-600/90 text-white text-xs font-bold px-2.5 py-1 rounded-full backdrop-blur-sm">
                      <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                      LIVE CAM
                    </div>
                    <button
                      onClick={() => setStreamMuted(m => !m)}
                      className="absolute top-3 right-3 p-2 rounded-full bg-black/50 hover:bg-black/80 backdrop-blur-sm text-white transition-colors"
                      title={streamMuted ? 'Unmute' : 'Mute'}
                    >
                      {streamMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </button>
                    {streamMuted && (
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
                        <button
                          onClick={() => setStreamMuted(false)}
                          className="flex items-center gap-2 bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white text-xs font-medium px-4 py-2 rounded-full transition-colors"
                        >
                          <Volume2 className="h-3.5 w-3.5" />
                          Tap to unmute
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center">
                    <Radio className="h-10 w-10 text-ironbound-grey-700 mx-auto mb-2" />
                    <p className="text-ironbound-grey-600 text-xs">Auction camera offline</p>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
