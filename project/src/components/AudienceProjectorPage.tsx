import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { LiveClerkService, LiveAuctionSession } from '../services/liveClerkService';
import { InventoryService } from '../services/inventoryService';
import { formatCurrency } from '../utils/formatters';

interface LotData {
  id: string;
  title: string;
  lot_number: string | null;
  images: string[];
}

export default function AudienceProjectorPage() {
  const eventId = (() => {
    const match = window.location.pathname.match(/\/projector\/([^/]+)/);
    return match ? match[1] : null;
  })();

  const [session, setSession] = useState<LiveAuctionSession | null>(null);
  const [currentLot, setCurrentLot] = useState<LotData | null>(null);
  const [lots, setLots] = useState<any[]>([]);
  const [bestImages, setBestImages] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [messageVisible, setMessageVisible] = useState(false);
  const messageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevMessageRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!eventId) return;
    loadInitial();
  }, [eventId]);

  // Primary: broadcast channel for near-instant updates from clerk
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

  // Fallback: postgres_changes for reconnects / missed events
  useEffect(() => {
    if (!eventId) return;

    const channel = supabase!
      .channel(`projector_pg_${eventId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'live_auction_sessions',
      }, (payload) => {
        const updated = payload.new as LiveAuctionSession;
        if (updated.event_id === eventId) {
          setSession(updated);
        }
      })
      .subscribe();

    return () => { supabase?.removeChannel(channel); };
  }, [eventId]);

  useEffect(() => {
    if (!session || lots.length === 0) return;
    const lot = lots[session.current_lot_index] ?? null;
    if (lot) {
      const hq = bestImages[lot.id];
      const images = hq && hq.length > 0
        ? hq
        : [lot.image_url, ...(lot.additional_images || [])].filter(Boolean) as string[];
      setCurrentLot({ id: lot.id, title: lot.title, lot_number: lot.lot_number, images });
    } else {
      setCurrentLot(null);
    }
  }, [session?.current_lot_index, session?.current_lot_id, lots, bestImages]);

  // Patch lots and currentLot in-place when an inventory item is updated
  useEffect(() => {
    if (!eventId) return;
    const channel = supabase!
      .channel(`projector_items_${eventId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'inventory_items',
      }, (payload) => {
        const changed = payload.new as any;
        setLots(prev => prev.map(lot => lot.id === changed.id ? { ...lot, ...changed } : lot));
        setCurrentLot(prev => prev && prev.id === changed.id ? { ...prev, title: changed.title ?? '' } : prev);
      })
      .subscribe();
    return () => { supabase?.removeChannel(channel); };
  }, [eventId]);

  useEffect(() => {
    if (!session) return;
    const msg = session.projector_message;
    if (msg && msg !== prevMessageRef.current) {
      prevMessageRef.current = msg;
      setMessage(msg);
      setMessageVisible(true);
      if (messageTimerRef.current) clearTimeout(messageTimerRef.current);
    }
  }, [session?.projector_message]);

  // Poll as a fallback every 5 seconds to catch any missed realtime events
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

  const loadInitial = async () => {
    try {
      const sess = await LiveClerkService.getOrCreateSession(eventId!);
      setSession(sess);
      sessionIdRef.current = sess.id;
      prevMessageRef.current = sess.projector_message;
      if (sess.projector_message) {
        setMessage(sess.projector_message);
        setMessageVisible(true);
      }
      const eventLots = await InventoryService.getItemsForEvent(eventId!);
      setLots(eventLots);
      const ids = eventLots.map((l: any) => l.id);
      const hq = await InventoryService.getBestQualityImagesForItems(ids);
      setBestImages(hq);
    } catch (err) {
      console.error('Projector load error:', err);
    }
  };

  const isActive = session?.status === 'running' || session?.status === 'paused';
  const imageIndex = session?.projector_image_index ?? 0;
  const displayImage = currentLot?.images[imageIndex] ?? currentLot?.images[0] ?? null;
  const lotNumber = currentLot?.lot_number ?? (session ? String((session.current_lot_index ?? 0) + 1) : null);
  const lotDisplay = lotNumber ?? '';

  if (!isActive || !session) {
    return <StandbyScreen />;
  }

  return (
    <div className="w-screen h-screen bg-[#323232] flex overflow-hidden">
      <div className="w-[30%] flex flex-col px-8 py-4 relative bg-[#323232]">
        <div className="flex justify-center items-center py-1 mb-0">
          <img
            src="/Screenshot_2026-04-18_162150.png"
            alt="IronBound Auctions"
            className="w-full max-w-[65%] object-contain opacity-90"
          />
        </div>

        <div className="flex-1 flex flex-col justify-start pt-4 gap-8">
          <div>
            <div className="text-white font-bold leading-none" style={{ fontSize: 'clamp(3rem, 6vw, 7rem)' }}>
              {lotDisplay}
            </div>
            {currentLot?.title && (
              <div className="text-[#ccc] font-medium mt-3 leading-snug" style={{ fontSize: 'clamp(1.4rem, 2.6vw, 2.4rem)' }}>
                {currentLot.title}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-6">
            <div>
              <div className="text-[#aaa] font-light" style={{ fontSize: 'clamp(1.2rem, 2.2vw, 2rem)' }}>
                Bid
              </div>
              <div
                className={`font-bold font-mono transition-all duration-300 ${session.current_bid > 0 ? 'text-white' : 'text-[#555]'}`}
                style={{ fontSize: 'clamp(2rem, 4vw, 4.5rem)' }}
              >
                {session.current_bid > 0 ? formatCurrency(session.current_bid) : '—'}
              </div>
            </div>

          </div>
        </div>

        <div className="flex-shrink-0 h-16 flex items-end">
          {messageVisible && message && (
            <div
              key={message}
              className="w-full text-white text-center font-semibold animate-fade-in-up truncate"
              style={{ fontSize: 'clamp(1rem, 1.6vw, 1.5rem)' }}
            >
              {message}
            </div>
          )}
        </div>
      </div>

      <div className="w-[70%] relative bg-black">
        {displayImage ? (
          <img
            key={displayImage}
            src={displayImage}
            alt={currentLot?.title}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-[#444] text-2xl font-medium">No image available</div>
          </div>
        )}
      </div>
    </div>
  );
}

function StandbyScreen() {
  return (
    <div className="w-screen h-screen relative overflow-hidden">
      <img
        src="/ironbound_primarylogog.png"
        alt="IronBound Auctions"
        className="absolute inset-0 w-full h-full object-cover"
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
