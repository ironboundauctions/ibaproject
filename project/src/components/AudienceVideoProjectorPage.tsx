import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { LiveClerkService, LiveAuctionSession } from '../services/liveClerkService';
import { InventoryService } from '../services/inventoryService';

export default function AudienceVideoProjectorPage() {
  const eventId = (() => {
    const match = window.location.pathname.match(/\/video-projector\/([^/]+)/);
    return match ? match[1] : null;
  })();

  const [session, setSession] = useState<LiveAuctionSession | null>(null);
  const [lots, setLots] = useState<any[]>([]);
  const [currentLot, setCurrentLot] = useState<{ id: string } | null>(null);
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!eventId) return;
    loadInitial();
  }, [eventId]);

  // Primary broadcast channel
  useEffect(() => {
    if (!eventId) return;
    const channel = supabase!
      .channel(`projector_broadcast_${eventId}`)
      .on('broadcast', { event: 'session_update' }, ({ payload }) => {
        setSession(payload as LiveAuctionSession);
      })
      .subscribe();
    return () => { supabase?.removeChannel(channel); };
  }, [eventId]);

  // Fallback: postgres_changes
  useEffect(() => {
    if (!eventId) return;
    const channel = supabase!
      .channel(`video_projector_pg_${eventId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'live_auction_sessions',
      }, (payload) => {
        const updated = payload.new as LiveAuctionSession;
        if (updated.event_id === eventId) setSession(updated);
      })
      .subscribe();
    return () => { supabase?.removeChannel(channel); };
  }, [eventId]);

  // Poll fallback every 5 seconds
  useEffect(() => {
    if (!eventId) return;
    const interval = setInterval(async () => {
      try {
        const { data } = await supabase!
          .from('live_auction_sessions')
          .select('*')
          .eq('event_id', eventId)
          .neq('status', 'ended')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (data) setSession(data as LiveAuctionSession);
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [eventId]);

  // Resolve currentLot from session
  useEffect(() => {
    if (!session || lots.length === 0) return;
    const lot = (session.current_lot_id
      ? lots.find((l: any) => l.id === session.current_lot_id)
      : lots[session.current_lot_index]) ?? null;
    setCurrentLot(lot ? { id: lot.id } : null);
  }, [session?.current_lot_index, session?.current_lot_id, lots]);

  // Fetch published video for current lot — mirrors AuctioneerProjectorPage exactly
  useEffect(() => {
    const itemId = currentLot?.id ?? null;
    if (!itemId) { setCurrentVideoUrl(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase!
          .from('auction_files')
          .select('cdn_url')
          .eq('item_id', itemId)
          .eq('variant', 'video')
          .eq('published_status', 'published')
          .is('detached_at', null)
          .not('cdn_url', 'is', null)
          .limit(1)
          .maybeSingle();
        if (cancelled) return;
        if (error) { setCurrentVideoUrl(null); return; }
        setCurrentVideoUrl(data?.cdn_url ?? null);
      } catch {
        if (!cancelled) setCurrentVideoUrl(null);
      }
    })();
    return () => { cancelled = true; };
  }, [currentLot?.id]);

  // Reload video element when url changes
  useEffect(() => {
    if (videoRef.current) videoRef.current.load();
  }, [currentVideoUrl]);

  const loadInitial = async () => {
    try {
      const sess = await LiveClerkService.getOrCreateSession(eventId!);
      setSession(sess);
      const eventLots = await InventoryService.getItemsForEvent(eventId!);
      setLots(eventLots);
    } catch (err) {
      console.error('Video projector load error:', err);
    }
  };

  const isActive = session?.status === 'running' || session?.status === 'paused';

  if (!isActive || !session) {
    return <VideoStandbyScreen />;
  }

  return (
    <div className="w-screen h-screen bg-black overflow-hidden">
      {currentVideoUrl ? (
        <video
          ref={videoRef}
          key={currentVideoUrl}
          src={currentVideoUrl}
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-contain"
        />
      ) : (
        <VideoStandbyScreen />
      )}
    </div>
  );
}

function VideoStandbyScreen() {
  return (
    <div className="w-screen h-screen relative overflow-hidden bg-black">
      <img
        src="/ironbound_primarylogog.png"
        alt="IronBound Auctions"
        className="absolute inset-0 w-full h-full object-cover opacity-80"
      />
      <div className="absolute bottom-12 left-0 right-0 flex justify-center">
        <div
          className="text-white font-light tracking-[0.4em] uppercase animate-pulse drop-shadow-lg"
          style={{ fontSize: 'clamp(1.2rem, 2.5vw, 2rem)' }}
        >
          Please Stand By...
        </div>
      </div>
    </div>
  );
}
