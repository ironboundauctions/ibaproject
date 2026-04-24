import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { LiveClerkService, LiveAuctionSession, HistoryLogEntry, LotResultEntry } from '../services/liveClerkService';
import { InventoryService } from '../services/inventoryService';
import { formatCurrency } from '../utils/formatters';
import { Wifi, WifiOff, Video, Users, ArrowUpCircle } from 'lucide-react';

interface LotData {
  id: string;
  title: string;
  lot_number: string | null;
  images: string[];
}

interface OnlineBidder {
  username: string;
  userId: string;
  isHovering: boolean;
  lastSeen: number;
}

interface IncomingBid {
  id: string;
  username: string;
  amount: number;
  timestamp: number;
}

export default function AuctioneerProjectorPage() {
  const eventId = (() => {
    const match = window.location.pathname.match(/\/auctioneer-projector\/([^/]+)/);
    return match ? match[1] : null;
  })();

  const [session, setSession] = useState<LiveAuctionSession | null>(null);
  const [currentLot, setCurrentLot] = useState<LotData | null>(null);
  const [lots, setLots] = useState<any[]>([]);
  const [bestImages, setBestImages] = useState<Record<string, string[]>>({});
  const [onlineBidders, setOnlineBidders] = useState<OnlineBidder[]>([]);
  const [incomingBids, setIncomingBids] = useState<IncomingBid[]>([]);
  const [recentBid, setRecentBid] = useState<IncomingBid | null>(null);
  const [recentBidFlash, setRecentBidFlash] = useState(false);
  const [historyLog, setHistoryLog] = useState<HistoryLogEntry[]>([]);
  const [recentSales, setRecentSales] = useState<LotResultEntry[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const recentBidTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!eventId) return;
    loadInitial();
  }, [eventId]);

  // Primary broadcast channel — same one clerk pushes to
  useEffect(() => {
    if (!eventId) return;
    const channel = supabase!
      .channel(`projector_broadcast_${eventId}`)
      .on('broadcast', { event: 'session_update' }, ({ payload }) => {
        setSession(payload as LiveAuctionSession);
      })
      .on('broadcast', { event: 'online_bid' }, ({ payload }) => {
        handleIncomingOnlineBid(payload as { username: string; userId: string; amount: number });
      })
      .on('broadcast', { event: 'bidder_hover' }, ({ payload }) => {
        const { userId, username, isHovering } = payload as { userId: string; username: string; isHovering: boolean };
        setOnlineBidders(prev => {
          const exists = prev.find(b => b.userId === userId);
          if (exists) {
            return prev.map(b => b.userId === userId ? { ...b, isHovering, lastSeen: Date.now() } : b);
          }
          return [...prev, { userId, username, isHovering, lastSeen: Date.now() }];
        });
      })
      .on('broadcast', { event: 'bidder_connect' }, ({ payload }) => {
        const { userId, username } = payload as { userId: string; username: string };
        setOnlineBidders(prev => {
          if (prev.find(b => b.userId === userId)) return prev;
          return [...prev, { userId, username, isHovering: false, lastSeen: Date.now() }];
        });
      })
      .on('broadcast', { event: 'bidder_disconnect' }, ({ payload }) => {
        const { userId } = payload as { userId: string };
        setOnlineBidders(prev => prev.filter(b => b.userId !== userId));
      })
      .on('broadcast', { event: 'lot_result' }, ({ payload }) => {
        const result = payload as LotResultEntry & { title?: string; image_url?: string };
        if (result.result === 'sold') {
          setRecentSales(prev => {
            const filtered = prev.filter(r => r.inventory_item_id !== result.inventory_item_id);
            return [result, ...filtered].slice(0, 5);
          });
        } else {
          setRecentSales(prev => prev.filter(r => r.inventory_item_id !== result.inventory_item_id));
        }
      })
      .subscribe();

    return () => { supabase?.removeChannel(channel); };
  }, [eventId]);

  // Fallback postgres_changes
  useEffect(() => {
    if (!eventId) return;
    const channel = supabase!
      .channel(`auctioneer_proj_pg_${eventId}`)
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

  // Subscribe to history log for online bid detection
  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase!
      .channel(`auctioneer_proj_history_${sessionId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_auction_history_log',
        filter: `session_id=eq.${sessionId}`,
      }, (payload) => {
        const entry = payload.new as HistoryLogEntry;
        setHistoryLog(prev => [...prev, entry]);
        if (entry.entry_type === 'bid_posted' && entry.metadata?.buyer_type === 'online') {
          const bid: IncomingBid = {
            id: entry.id,
            username: entry.metadata?.bidder_name ?? 'Online Bidder',
            amount: entry.metadata?.amount ?? 0,
            timestamp: Date.now(),
          };
          flashIncomingBid(bid);
        }
      })
      .subscribe();
    return () => { supabase?.removeChannel(channel); };
  }, [sessionId]);

  // Subscribe to lot results for recent sales feed
  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase!
      .channel(`auctioneer_proj_results_${sessionId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'live_auction_lot_results',
        filter: `session_id=eq.${sessionId}`,
      }, async () => {
        const results = await LiveClerkService.getLotResults(sessionId);
        const sold = results
          .filter(r => r.result === 'sold')
          .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
          .slice(0, 5);
        setRecentSales(sold);
      })
      .subscribe();
    return () => { supabase?.removeChannel(channel); };
  }, [sessionId]);

  // Poll fallback every 5s
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

  const handleIncomingOnlineBid = (payload: { username: string; userId: string; amount: number }) => {
    const bid: IncomingBid = {
      id: `${Date.now()}-${Math.random()}`,
      username: payload.username,
      amount: payload.amount,
      timestamp: Date.now(),
    };
    flashIncomingBid(bid);
  };

  const flashIncomingBid = (bid: IncomingBid) => {
    setRecentBid(bid);
    setRecentBidFlash(true);
    setIncomingBids(prev => [bid, ...prev].slice(0, 10));
    if (recentBidTimerRef.current) clearTimeout(recentBidTimerRef.current);
    recentBidTimerRef.current = setTimeout(() => {
      setRecentBidFlash(false);
    }, 4000);
  };

  const loadInitial = async () => {
    try {
      const sess = await LiveClerkService.getOrCreateSession(eventId!);
      setSession(sess);
      sessionIdRef.current = sess.id;
      setSessionId(sess.id);
      const eventLots = await InventoryService.getItemsForEvent(eventId!);
      setLots(eventLots);
      const ids = eventLots.map((l: any) => l.id);
      const hq = await InventoryService.getBestQualityImagesForItems(ids);
      setBestImages(hq);
      const log = await LiveClerkService.getHistoryLog(sess.id);
      setHistoryLog(log);
      const results = await LiveClerkService.getLotResults(sess.id);
      const sold = results
        .filter(r => r.result === 'sold')
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 5);
      setRecentSales(sold);
    } catch (err) {
      console.error('Auctioneer projector load error:', err);
    }
  };

  const isActive = session?.status === 'running' || session?.status === 'paused';
  const imageIndex = session?.projector_image_index ?? 0;
  const displayImage = currentLot?.images[imageIndex] ?? currentLot?.images[0] ?? null;
  const lotNumber = currentLot?.lot_number ?? (session ? String((session.current_lot_index ?? 0) + 1) : null);

  if (!isActive || !session) {
    return <AuctioneerStandby />;
  }

  const hoveringBidders = onlineBidders.filter(b => b.isHovering);

  return (
    <div className="w-screen h-screen bg-[#2a2a2a] flex overflow-hidden select-none">

      {/* LEFT COLUMN — lot info + image + video placeholder */}
      <div className="flex flex-col" style={{ width: '42%' }}>

        {/* Lot number + title */}
        <div className="bg-[#1e1e1e] px-6 py-4 border-b border-[#3a3a3a]">
          <div className="flex items-baseline gap-4">
            <div className="text-[#e8e8e8] font-bold leading-none" style={{ fontSize: 'clamp(2.2rem, 4vw, 4rem)' }}>
              {lotNumber ?? '—'}
            </div>
            {session.status === 'paused' && (
              <span className="text-xs font-semibold uppercase tracking-widest text-amber-400 bg-amber-400/10 px-2 py-1 rounded">
                Paused
              </span>
            )}
          </div>
          {currentLot?.title && (
            <div className="text-[#aaa] font-medium mt-1 leading-snug truncate" style={{ fontSize: 'clamp(0.9rem, 1.6vw, 1.3rem)' }}>
              {currentLot.title}
            </div>
          )}
        </div>

        {/* Item image — ~quarter screen */}
        <div className="bg-black relative" style={{ height: '32%' }}>
          {displayImage ? (
            <img
              key={displayImage}
              src={displayImage}
              alt={currentLot?.title}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-[#444] text-sm font-medium">No image</div>
            </div>
          )}
          {currentLot && currentLot.images.length > 1 && (
            <div className="absolute bottom-2 right-2 bg-black/60 text-[#aaa] text-xs px-2 py-1 rounded">
              {currentLot.images.length} photos
            </div>
          )}
        </div>

        {/* Video placeholder */}
        <div className="bg-[#111] border-t border-[#333] flex items-center justify-center" style={{ height: '22%' }}>
          <div className="flex flex-col items-center gap-2 text-[#3a3a3a]">
            <Video className="h-8 w-8" />
            <span className="text-xs font-medium tracking-wider uppercase">Video Feed</span>
            <span className="text-[10px] text-[#333]">Coming soon</span>
          </div>
        </div>

        {/* Bid prices */}
        <div className="flex flex-1 divide-x divide-[#3a3a3a] bg-[#1a1a1a]">
          <div className="flex-1 flex flex-col items-center justify-center gap-1 px-4">
            <div className="text-[#888] text-xs font-semibold uppercase tracking-widest">Asking</div>
            <div
              className={`font-bold font-mono tabular-nums transition-all duration-200 ${session.asking_price > 0 ? 'text-[#e8e8e8]' : 'text-[#444]'}`}
              style={{ fontSize: 'clamp(1.6rem, 3vw, 2.8rem)' }}
            >
              {session.asking_price > 0 ? formatCurrency(session.asking_price) : '—'}
            </div>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center gap-1 px-4">
            <div className="text-[#888] text-xs font-semibold uppercase tracking-widest">Current Bid</div>
            <div
              className={`font-bold font-mono tabular-nums transition-all duration-200 ${session.current_bid > 0 ? 'text-white' : 'text-[#444]'}`}
              style={{ fontSize: 'clamp(1.6rem, 3vw, 2.8rem)' }}
            >
              {session.current_bid > 0 ? formatCurrency(session.current_bid) : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* CENTER DIVIDER */}
      <div className="w-px bg-[#3a3a3a]" />

      {/* RIGHT COLUMN — online activity */}
      <div className="flex flex-col flex-1 overflow-hidden">

        {/* TOP: Incoming online bid flash panel */}
        <div
          className={`relative flex-shrink-0 transition-all duration-300 border-b border-[#3a3a3a] overflow-hidden ${recentBidFlash ? 'bg-emerald-900/40' : 'bg-[#1a1a1a]'}`}
          style={{ height: '38%' }}
        >
          <div className="px-5 pt-4 pb-2 flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${recentBidFlash ? 'bg-emerald-400 animate-pulse' : 'bg-[#444]'}`} />
            <span className="text-xs font-bold uppercase tracking-widest text-[#888]">Online Bid Incoming</span>
          </div>

          {recentBid && recentBidFlash ? (
            <div className="flex flex-col items-center justify-center h-[calc(100%-3rem)] gap-3">
              <div
                className="font-black font-mono tabular-nums text-emerald-300"
                style={{ fontSize: 'clamp(2.4rem, 5vw, 5rem)' }}
              >
                {formatCurrency(recentBid.amount)}
              </div>
              <div className="flex items-center gap-2">
                <ArrowUpCircle className="h-5 w-5 text-emerald-400" />
                <span className="text-emerald-200 font-semibold text-lg">{recentBid.username}</span>
              </div>
              <span className="text-emerald-600 text-xs">placed an online bid</span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[calc(100%-3rem)] gap-2">
              <Wifi className="h-8 w-8 text-[#333]" />
              <span className="text-[#444] text-sm">Waiting for online bids...</span>
              {incomingBids.length > 0 && (
                <span className="text-[#555] text-xs">{incomingBids.length} bid{incomingBids.length !== 1 ? 's' : ''} this lot</span>
              )}
            </div>
          )}
        </div>

        {/* MIDDLE: Online bidder list */}
        <div className="flex flex-col border-b border-[#3a3a3a]" style={{ height: '38%' }}>
          <div className="px-5 pt-3 pb-2 flex items-center gap-2 flex-shrink-0">
            <Users className="h-3.5 w-3.5 text-[#666]" />
            <span className="text-xs font-bold uppercase tracking-widest text-[#888]">Online Bidders</span>
            {onlineBidders.length > 0 && (
              <span className="ml-auto text-xs text-[#555] font-mono">{onlineBidders.length} connected</span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-5 pb-3 flex flex-col gap-1.5">
            {onlineBidders.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-2 text-[#444]">
                  <WifiOff className="h-6 w-6" />
                  <span className="text-xs">No online bidders connected</span>
                </div>
              </div>
            ) : (
              onlineBidders.map(bidder => (
                <div
                  key={bidder.userId}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-300 ${
                    bidder.isHovering
                      ? 'bg-amber-500/20 border border-amber-500/40'
                      : 'bg-[#252525] border border-transparent'
                  }`}
                >
                  <div className={`h-2 w-2 rounded-full flex-shrink-0 ${bidder.isHovering ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`} />
                  <span className={`text-sm font-medium flex-1 ${bidder.isHovering ? 'text-amber-300' : 'text-[#ccc]'}`}>
                    {bidder.username}
                  </span>
                  {bidder.isHovering && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">
                      Ready
                    </span>
                  )}
                </div>
              ))
            )}
          </div>

          {hoveringBidders.length > 0 && (
            <div className="px-5 pb-3 flex-shrink-0">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 text-center">
                <span className="text-amber-300 text-xs font-semibold">
                  {hoveringBidders.length === 1
                    ? `${hoveringBidders[0].username} is ready to bid`
                    : `${hoveringBidders.length} bidders hovering`}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM: Recent sales */}
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="px-5 pt-3 pb-2 flex items-center gap-2 flex-shrink-0">
            <span className="text-xs font-bold uppercase tracking-widest text-[#888]">Recent Sales</span>
          </div>
          <div className="flex-1 overflow-y-auto px-5 pb-4 flex flex-col gap-1.5">
            {recentSales.length === 0 ? (
              <div className="text-[#444] text-xs italic px-1">No sales recorded yet</div>
            ) : (
              recentSales.map((sale, i) => {
                const lotLabel = sale.lot_number ?? '—';
                const priceLabel = sale.sold_price != null ? formatCurrency(sale.sold_price) : '—';
                const buyerLabel = sale.buyer_type === 'floor' || sale.buyer_type === 'absentee'
                  ? 'FLOOR'
                  : (sale.buyer_id ? sale.buyer_id.slice(0, 4).toUpperCase() : 'ONLINE');
                const isFloor = sale.buyer_type === 'floor' || sale.buyer_type === 'absentee';
                return (
                  <div
                    key={sale.id || sale.inventory_item_id}
                    className={`flex items-center px-3 py-2 rounded font-mono text-sm tracking-wide ${
                      i === 0
                        ? 'bg-[#252525] border border-[#3a3a3a] text-[#e8e8e8]'
                        : 'text-[#666]'
                    }`}
                  >
                    <span className="font-bold flex-shrink-0">{lotLabel}</span>
                    <span className="mx-2 text-[#444]">—</span>
                    <span className={`flex-1 ${i === 0 ? 'text-white' : ''}`}>{priceLabel}</span>
                    <span className={`flex-shrink-0 text-xs font-bold ${isFloor ? 'text-[#888]' : 'text-emerald-400'}`}>
                      {buyerLabel}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AuctioneerStandby() {
  return (
    <div className="w-screen h-screen bg-[#1e1e1e] flex flex-col items-center justify-center gap-6">
      <img
        src="/Screenshot_2026-04-18_162150.png"
        alt="IronBound Auctions"
        className="w-48 object-contain opacity-60"
      />
      <div className="text-[#555] text-sm font-medium uppercase tracking-widest">
        Auctioneer View — Standby
      </div>
      <div className="h-px w-24 bg-[#333]" />
      <div className="text-[#444] text-xs">Waiting for auction to start...</div>
    </div>
  );
}
