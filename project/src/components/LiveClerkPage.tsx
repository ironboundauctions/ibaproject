import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Gavel, AlertTriangle, RefreshCw, Users, Monitor, UserCheck, ShieldAlert } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { InventoryService } from '../services/inventoryService';
import { LiveClerkService, LiveAuctionSession, BidIncrement, HistoryLogEntry, ClerkLot, SessionStatus, LotResultEntry } from '../services/liveClerkService';
import { formatCurrency, formatDate } from '../utils/formatters';
import BidIncrementLadder from './liveClerk/BidIncrementLadder';
import BidUndoPanel, { BidSnapshot } from './liveClerk/BidUndoPanel';
import AuctionControls from './liveClerk/AuctionControls';
import LotResultControls from './liveClerk/LotResultControls';
import CurrentLotPanel from './liveClerk/CurrentLotPanel';
import AuctionHistoryPanel from './liveClerk/AuctionHistoryPanel';
import MessagesPanel from './liveClerk/MessagesPanel';
import LotCatalogPanel from './liveClerk/LotCatalogPanel';

const MESSAGE_PRESETS = ['HURRY', 'BID FAST', 'Good Morning', 'TYVM', 'DELAY', 'Last second'];
const PROJECTOR_PRESETS = ['Going once', 'Going twice', 'SOLD!', 'Opening bid', 'No reserve', 'Choice lot', 'Winner!'];

interface EventInfo {
  id: string;
  title: string;
  start_date: string;
  event_number: string;
  status: string;
}

interface CurrentUser {
  id: string;
  name: string;
}

export default function LiveClerkPage() {
  const eventId = (() => {
    const match = window.location.pathname.match(/\/clerk\/([^/]+)/);
    return match ? match[1] : null;
  })();

  const [eventInfo, setEventInfo] = useState<EventInfo | null>(null);
  const [lots, setLots] = useState<ClerkLot[]>([]);
  const [session, setSession] = useState<LiveAuctionSession | null>(null);
  const [increments, setIncrements] = useState<BidIncrement[]>([]);
  const [historyLog, setHistoryLog] = useState<HistoryLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isTakingOver, setIsTakingOver] = useState(false);

  const [selectedIncrement, setSelectedIncrement] = useState<number | null>(null);
  const [askingPrice, setAskingPrice] = useState(0);
  const [bidHistory, setBidHistory] = useState<BidSnapshot[]>([]);
  const [lotResults, setLotResults] = useState<Record<string, LotResultEntry>>({});
  const [bestImages, setBestImages] = useState<Record<string, string[]>>({});
  const [autoStartNext, setAutoStartNext] = useState(true);
  const [enterFloorPrice, setEnterFloorPrice] = useState(true);
  const [postWithOneClick, setPostWithOneClick] = useState(false);
  const [decrementMode, setDecrementMode] = useState(false);

  const sessionRef = useRef<LiveAuctionSession | null>(null);
  sessionRef.current = session;
  const currentUserRef = useRef<CurrentUser | null>(null);
  currentUserRef.current = currentUser;

  const currentLot = session && lots.length > 0 ? lots[session.current_lot_index] ?? null : null;

  const isActiveClerk = !!(
    currentUser &&
    session?.active_clerk_id === currentUser.id
  );

  const anotherClerkActive = !!(
    session?.active_clerk_id &&
    currentUser &&
    session.active_clerk_id !== currentUser.id
  );

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase!.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase!
        .from('user_profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();
      const name = profile?.full_name || user.email?.split('@')[0] || 'Unknown Clerk';
      setCurrentUser({ id: user.id, name });
    };
    getUser();
  }, []);

  useEffect(() => {
    if (!eventId) {
      setError('No event ID found in URL. Expected: /clerk/{eventId}');
      setLoading(false);
      return;
    }
    loadAll();
  }, [eventId]);

  useEffect(() => {
    if (!session || !currentUser) return;

    if (!session.active_clerk_id) {
      LiveClerkService.claimSession(session.id, currentUser.id, currentUser.name)
        .then(updated => setSession(updated))
        .catch(() => {});
    }
  }, [session?.id, currentUser]);

  useEffect(() => {
    if (!session) return;

    const sessionSub = LiveClerkService.subscribeToSession(session.id, (updated) => {
      setSession(updated);
      setAskingPrice(updated.asking_price);
    });

    const historySub = LiveClerkService.subscribeToHistory(session.id, (entry) => {
      setHistoryLog(prev => prev.some(e => e.id === entry.id) ? prev : [...prev, entry]);
    });

    const resultsSub = LiveClerkService.subscribeToLotResults(session.id, (result) => {
      if (result.inventory_item_id) {
        setLotResults(prev => ({ ...prev, [result.inventory_item_id!]: result }));
      }
    });

    return () => {
      supabase?.removeChannel(sessionSub);
      supabase?.removeChannel(historySub);
      supabase?.removeChannel(resultsSub);
    };
  }, [session?.id]);

  useEffect(() => {
    const handleUnload = () => {
      const sess = sessionRef.current;
      const user = currentUserRef.current;
      if (!sess || !user || sess.active_clerk_id !== user.id) return;
      navigator.sendBeacon(
        `/api/release-session?sessionId=${sess.id}`,
        ''
      );
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  const loadAll = async () => {
    try {
      setLoading(true);
      setError(null);

      const [eventData, eventLots, sess] = await Promise.all([
        supabase!.from('auction_events').select('id, title, start_date, event_number, status').eq('id', eventId!).single(),
        InventoryService.getItemsForEvent(eventId!),
        LiveClerkService.getOrCreateSession(eventId!),
      ]);

      if (eventData.error) throw eventData.error;
      setEventInfo(eventData.data as EventInfo);
      setLots(eventLots);
      setSession(sess);
      setAskingPrice(sess.asking_price ?? 0);

      const ids = eventLots.map((l: any) => l.id);
      InventoryService.getBestQualityImagesForItems(ids).then(setBestImages).catch(() => {});

      const [incs, history, results] = await Promise.all([
        LiveClerkService.getBidIncrements(eventId!),
        LiveClerkService.getHistoryLog(sess.id),
        LiveClerkService.getLotResults(sess.id),
      ]);

      setIncrements(incs);
      setHistoryLog(history);

      const resultsMap: Record<string, LotResultEntry> = {};
      for (const r of results) {
        if (r.inventory_item_id) resultsMap[r.inventory_item_id] = r;
      }
      setLotResults(resultsMap);

      if (incs.length > 0) {
        setSelectedIncrement(incs[Math.floor(incs.length / 2)]?.amount ?? null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load auction data');
    } finally {
      setLoading(false);
    }
  };

  const handleTakeOver = async () => {
    if (!session || !currentUser) return;
    setIsTakingOver(true);
    try {
      const updated = await LiveClerkService.claimSession(session.id, currentUser.id, currentUser.name);
      setSession(updated);
      await LiveClerkService.addHistoryEntry(
        session.id,
        eventId!,
        'clerk_takeover',
        `${currentUser.name} took over as active clerk`,
        {},
        currentUser.id,
        currentUser.name
      );
    } catch (err: any) {
      alert(`Take over failed: ${err.message}`);
    } finally {
      setIsTakingOver(false);
    }
  };

  const log = useCallback(async (entryType: Parameters<typeof LiveClerkService.addHistoryEntry>[2], message: string, metadata?: Record<string, any>) => {
    const sess = sessionRef.current;
    const user = currentUserRef.current;
    if (!sess || !eventId) return;
    try {
      const entry = await LiveClerkService.addHistoryEntry(
        sess.id, eventId, entryType, message, metadata,
        user?.id, user?.name
      );
      setHistoryLog(prev => prev.some(e => e.id === entry.id) ? prev : [...prev, entry]);
    } catch {}
  }, [eventId]);

  const handleStart = async () => {
    if (!session) return;
    const updated = await LiveClerkService.startAuction(session.id);
    setSession(updated);
    const lot = lots[updated.current_lot_index];
    await log('auction_start', `Auction started`);
    if (lot) await log('lot_start', `Lot ${updated.current_lot_index + 1} started: ${lot.title}`);
  };

  const handlePause = async () => {
    if (!session) return;
    const updated = await LiveClerkService.pauseAuction(session.id);
    setSession(updated);
    await log('auction_pause', 'Auction paused');
  };

  const handleResume = async () => {
    if (!session) return;
    const updated = await LiveClerkService.resumeAuction(session.id);
    setSession(updated);
    await log('auction_resume', 'Auction resumed');
  };

  const handleStop = async () => {
    if (!session || !window.confirm('Stop this auction? This cannot be undone.')) return;
    const updated = await LiveClerkService.stopAuction(session.id);
    setSession(updated);
    await log('auction_end', 'Auction ended');
  };

  const handleSelectLot = async (index: number, skipLog = false) => {
    if (!session || index < 0 || index >= lots.length) return;
    const lot = lots[index];
    const savedResult = lotResults[lot.id];

    const bid = savedResult?.sold_price ?? 0;
    const asking = savedResult?.sold_price ?? 0;

    const updated = await LiveClerkService.advanceToLot(session.id, index, lot.id, bid, asking);
    setSession(updated);
    setAskingPrice(asking);
    setSelectedIncrement(null);
    setBidHistory([]);

    if (!skipLog) {
      if (savedResult) {
        const resultLabel = savedResult.result === 'sold' ? `SOLD — ${formatCurrency(savedResult.sold_price ?? 0)}` : savedResult.result.toUpperCase();
        await log('lot_start', `Returned to Lot ${index + 1}: ${lot.title} (previously ${resultLabel})`, { lot_id: lot.id });
      } else {
        await log('lot_start', `Lot ${index + 1} started: ${lot.title}`, { lot_id: lot.id, lot_number: lot.lot_number });
      }
    }
  };

  const handlePrevLot = () => {
    if (!session || session.current_lot_index <= 0) return;
    handleSelectLot(session.current_lot_index - 1);
  };

  const handleNextLot = () => {
    if (!session || session.current_lot_index >= lots.length - 1) return;
    handleSelectLot(session.current_lot_index + 1);
  };

  const handleIncrementClick = useCallback(async (amount: number) => {
    setSelectedIncrement(amount);
    const currentBidVal = sessionRef.current?.current_bid ?? 0;
    const newAsking = currentBidVal + amount;
    setAskingPrice(newAsking);
    if (sessionRef.current?.status === 'running') {
      const updated = await LiveClerkService.updateSession(sessionRef.current.id, { asking_price: newAsking });
      setSession(updated);
    }
  }, []);

  const handleIncrementDoubleClick = useCallback(async (amount: number) => {
    const sess = sessionRef.current;
    if (!sess) return;
    setSelectedIncrement(amount);
    const postedBid = sess.asking_price > 0 ? sess.asking_price : (sess.current_bid + amount);
    const newAsking = postedBid + amount;
    setAskingPrice(newAsking);
    if (sess.status === 'running') {
      setBidHistory(prev => [...prev, { current_bid: sess.current_bid, asking_price: sess.asking_price }]);
      const updated = await LiveClerkService.updateSession(sess.id, {
        current_bid: postedBid,
        asking_price: newAsking,
      });
      setSession(updated);
      await log('bid_posted', `Bid: ${formatCurrency(postedBid)} — Asking: ${formatCurrency(newAsking)}`, {
        current_bid: postedBid,
        asking: newAsking,
      });
    }
  }, [log]);

  const handleOverrideAsk = async (price: number) => {
    if (!session || session.status !== 'running') return;
    const updated = await LiveClerkService.updateSession(session.id, { asking_price: price });
    setSession(updated);
    setAskingPrice(price);
    await log('system', `Override ask: ${formatCurrency(price)}`, { asking: price });
  };

  const handleOverridePost = async (price: number) => {
    if (!session || session.status !== 'running') return;
    setBidHistory(prev => [...prev, { current_bid: session.current_bid, asking_price: session.asking_price }]);
    const updated = await LiveClerkService.updateSession(session.id, {
      current_bid: price,
      asking_price: price,
    });
    setSession(updated);
    setAskingPrice(price);
    setSelectedIncrement(null);
    await log('bid_posted', `Override bid posted: ${formatCurrency(price)}`, { current_bid: price, asking: price });
  };

  const handleSold = async () => {
    if (!session || !currentLot) return;
    try {
      const price = session.current_bid;
      const now = new Date().toISOString();
      await LiveClerkService.recordLotResult(session.id, eventId!, currentLot, 'sold', price, 'floor');
      const resultEntry: LotResultEntry = {
        id: '', session_id: session.id, event_id: eventId!, inventory_item_id: currentLot.id,
        lot_number: currentLot.lot_number ?? null, result: 'sold', sold_price: price,
        buyer_type: 'floor', notes: null, updated_at: now, created_at: now,
      };
      setLotResults(prev => ({ ...prev, [currentLot.id]: resultEntry }));
      await supabase!.channel(`projector_broadcast_${eventId}`).send({
        type: 'broadcast',
        event: 'lot_result',
        payload: { ...resultEntry, title: currentLot.title, image_url: currentLot.image_url ?? null },
      });
      await log('lot_sold', `Lot ${session.current_lot_index + 1} SOLD for ${formatCurrency(price)} — ${currentLot.title}`, {
        lot_id: currentLot.id, price,
      });
      if (autoStartNext && session.current_lot_index < lots.length - 1) {
        handleSelectLot(session.current_lot_index + 1);
      }
    } catch (err: any) {
      alert(`Sold failed: ${err.message}`);
    }
  };

  const handlePass = async () => {
    if (!session || !currentLot) return;
    try {
      await LiveClerkService.recordLotResult(session.id, eventId!, currentLot, 'passed');
      setLotResults(prev => ({ ...prev, [currentLot.id]: {
        id: '', session_id: session.id, event_id: eventId!, inventory_item_id: currentLot.id,
        lot_number: currentLot.lot_number ?? null, result: 'passed', sold_price: null,
        buyer_type: null, notes: null, updated_at: new Date().toISOString(), created_at: new Date().toISOString(),
      }}));
      await log('lot_passed', `Lot ${session.current_lot_index + 1} PASSED — ${currentLot.title}`);
      if (autoStartNext && session.current_lot_index < lots.length - 1) {
        handleSelectLot(session.current_lot_index + 1);
      }
    } catch (err: any) {
      alert(`Pass failed: ${err.message}`);
    }
  };

  const handleConditional = async () => {
    if (!session || !currentLot) return;
    try {
      const price = session.current_bid;
      await LiveClerkService.recordLotResult(session.id, eventId!, currentLot, 'conditional', price);
      setLotResults(prev => ({ ...prev, [currentLot.id]: {
        id: '', session_id: session.id, event_id: eventId!, inventory_item_id: currentLot.id,
        lot_number: currentLot.lot_number ?? null, result: 'conditional', sold_price: price,
        buyer_type: null, notes: null, updated_at: new Date().toISOString(), created_at: new Date().toISOString(),
      }}));
      await log('lot_sold', `Lot ${session.current_lot_index + 1} CONDITIONAL — ${formatCurrency(price)} — ${currentLot.title}`);
    } catch (err: any) {
      alert(`Conditional failed: ${err.message}`);
    }
  };

  const handleFail = async () => {
    if (!session || !currentLot) return;
    try {
      await LiveClerkService.recordLotResult(session.id, eventId!, currentLot, 'no_sale');
      setLotResults(prev => ({ ...prev, [currentLot.id]: {
        id: '', session_id: session.id, event_id: eventId!, inventory_item_id: currentLot.id,
        lot_number: currentLot.lot_number ?? null, result: 'no_sale', sold_price: null,
        buyer_type: null, notes: null, updated_at: new Date().toISOString(), created_at: new Date().toISOString(),
      }}));
      await log('lot_passed', `Lot ${session.current_lot_index + 1} NO SALE — ${currentLot.title}`);
    } catch (err: any) {
      alert(`No sale failed: ${err.message}`);
    }
  };

  const handleUndoBid = useCallback(async () => {
    const sess = sessionRef.current;
    if (!sess || bidHistory.length === 0) return;
    const snapshot = bidHistory[bidHistory.length - 1];
    setBidHistory(prev => prev.slice(0, -1));
    const updated = await LiveClerkService.updateSession(sess.id, {
      current_bid: snapshot.current_bid,
      asking_price: snapshot.asking_price,
    });
    setSession(updated);
    setAskingPrice(snapshot.asking_price);
    await log('system', `Bid undone — restored to ${formatCurrency(snapshot.current_bid)}`, { current_bid: snapshot.current_bid });
  }, [bidHistory, log]);

  const handleResetBidding = async () => {
    if (!session || !currentLot) return;
    const existingResult = lotResults[currentLot.id];
    const confirmMsg = existingResult
      ? `Reset bidding for Lot ${session.current_lot_index + 1}? This will clear the ${existingResult.result === 'sold' ? `SOLD result (${formatCurrency(existingResult.sold_price ?? 0)})` : existingResult.result.toUpperCase() + ' result'} and restart bidding from $0.`
      : `Reset bidding for Lot ${session.current_lot_index + 1}? This will clear the current bid and asking price.`;
    if (!window.confirm(confirmMsg)) return;

    if (existingResult && currentLot.id) {
      await LiveClerkService.clearLotResult(session.id, currentLot.id);
      setLotResults(prev => {
        const next = { ...prev };
        delete next[currentLot.id];
        return next;
      });
    }

    const updated = await LiveClerkService.updateSession(session.id, { current_bid: 0, asking_price: 0 });
    setSession(updated);
    setAskingPrice(0);
    setBidHistory([]);
    setSelectedIncrement(null);

    const lotLabel = `Lot ${session.current_lot_index + 1}: ${currentLot.title}`;
    if (existingResult?.result === 'sold') {
      await log('system', `Bidding RESET on ${lotLabel} — previous SOLD result of ${formatCurrency(existingResult.sold_price ?? 0)} cleared`, {
        lot_id: currentLot.id, previous_result: existingResult.result, previous_price: existingResult.sold_price,
      });
    } else {
      await log('system', `Bidding reset on ${lotLabel}`, { lot_id: currentLot.id });
    }
  };

  const handleSaveIncrements = async (amounts: number[]) => {
    if (!eventId) return;
    await LiveClerkService.saveBidIncrements(eventId, amounts);
    const updated = await LiveClerkService.getBidIncrements(eventId);
    setIncrements(updated);
  };

  const statusColor: Record<SessionStatus, string> = {
    idle: 'text-ironbound-grey-400',
    running: 'text-green-400',
    paused: 'text-yellow-400',
    ended: 'text-red-400',
  };

  const statusLabel: Record<SessionStatus, string> = {
    idle: 'Ready',
    running: 'LIVE',
    paused: 'PAUSED',
    ended: 'ENDED',
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-ironbound-grey-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-ironbound-orange-500 mx-auto mb-3"></div>
          <p className="text-ironbound-grey-300 text-sm">Loading live clerk...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-ironbound-grey-900 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-3" />
          <h2 className="text-white font-bold text-lg mb-2">Failed to Load</h2>
          <p className="text-ironbound-grey-400 text-sm mb-4">{error}</p>
          <button onClick={loadAll} className="flex items-center gap-2 mx-auto px-4 py-2 bg-ironbound-orange-500 hover:bg-ironbound-orange-600 text-white rounded-lg transition-colors">
            <RefreshCw className="h-4 w-4" /> Retry
          </button>
        </div>
      </div>
    );
  }

  const controlsDisabled = anotherClerkActive;

  return (
    <div className="h-screen bg-ironbound-grey-900 flex flex-col overflow-hidden text-white">
      <header className="flex-shrink-0 bg-ironbound-grey-800 border-b border-ironbound-grey-700 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Gavel className="h-5 w-5 text-ironbound-orange-500 flex-shrink-0" />
          <div>
            <div className="text-xs text-ironbound-grey-400">
              {eventInfo?.event_number && <span className="font-mono mr-2">#{eventInfo.event_number}</span>}
              {eventInfo?.start_date && formatDate(eventInfo.start_date)}
            </div>
            <h1 className="text-sm font-bold text-white leading-tight">{eventInfo?.title || 'Live Auction'}</h1>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Clerk identity badge */}
          {currentUser && (
            <div className="flex items-center gap-1.5 text-xs">
              {isActiveClerk ? (
                <span className="flex items-center gap-1 bg-green-900/60 border border-green-700 text-green-300 px-2 py-1 rounded-full font-semibold">
                  <UserCheck className="h-3 w-3" />
                  Active Clerk
                </span>
              ) : anotherClerkActive ? (
                <span className="flex items-center gap-1 bg-yellow-900/60 border border-yellow-700 text-yellow-300 px-2 py-1 rounded-full font-semibold">
                  <ShieldAlert className="h-3 w-3" />
                  Observer
                </span>
              ) : (
                <span className="flex items-center gap-1 bg-ironbound-grey-700 text-ironbound-grey-400 px-2 py-1 rounded-full">
                  {currentUser.name}
                </span>
              )}
            </div>
          )}

          <div className="text-xs text-ironbound-grey-400">
            {lots.length > 0 && session && (
              <span>Lot {session.current_lot_index + 1} of {lots.length}</span>
            )}
          </div>
          <div className={`flex items-center gap-1.5 text-sm font-bold ${session ? statusColor[session.status] : 'text-ironbound-grey-400'}`}>
            {session?.status === 'running' && <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span>}
            {session ? statusLabel[session.status] : '—'}
          </div>
          <button onClick={loadAll} title="Refresh" className="p-1.5 text-ironbound-grey-400 hover:text-white hover:bg-ironbound-grey-700 rounded transition-colors">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Observer / Take Over banner */}
      {anotherClerkActive && (
        <div className="flex-shrink-0 bg-yellow-900/80 border-b-2 border-yellow-600 px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="h-4 w-4 text-yellow-400 flex-shrink-0" />
            <div>
              <span className="text-yellow-200 text-sm font-semibold">
                {session?.active_clerk_name || 'Another clerk'} is the active clerk
              </span>
              <span className="text-yellow-400 text-xs ml-2">
                — You are observing. All changes sync live to this screen.
              </span>
            </div>
          </div>
          <button
            onClick={handleTakeOver}
            disabled={isTakingOver}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-400 disabled:bg-yellow-700 text-yellow-950 font-bold text-sm rounded-lg transition-colors flex-shrink-0"
          >
            {isTakingOver ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-900" />
            ) : (
              <UserCheck className="h-4 w-4" />
            )}
            Take Over as Active Clerk
          </button>
        </div>
      )}

      <div className="flex-1 overflow-hidden grid grid-cols-[160px_1fr_260px] gap-0">
        {/* Left sidebar — auction start/stop controls + settings */}
        <div className={`bg-ironbound-grey-800 border-r border-ironbound-grey-700 flex flex-col overflow-y-auto p-3 transition-opacity ${controlsDisabled ? 'opacity-40 pointer-events-none' : ''}`}>
          <AuctionControls
            sessionStatus={session?.status ?? 'idle'}
            onStart={handleStart}
            onPause={handlePause}
            onResume={handleResume}
            onStop={handleStop}
            onResetBidding={handleResetBidding}
            autoStartNext={autoStartNext}
            onAutoStartNextChange={setAutoStartNext}
            enterFloorPrice={enterFloorPrice}
            onEnterFloorPriceChange={setEnterFloorPrice}
            postWithOneClick={postWithOneClick}
            onPostWithOneClickChange={setPostWithOneClick}
            decrement={decrementMode}
            onDecrementChange={setDecrementMode}
          />
        </div>

        {/* Center column */}
        <div className="flex flex-col overflow-hidden">
          {/* Top: current lot info */}
          <div className="flex-shrink-0 p-4 border-b border-ironbound-grey-700">
            <CurrentLotPanel
              lot={currentLot}
              totalLots={lots.length}
              currentIndex={session?.current_lot_index ?? 0}
              currentBid={session?.current_bid ?? 0}
              askingPrice={askingPrice}
              sessionId={session?.id ?? null}
              eventId={eventId}
              projectorImageIndex={session?.projector_image_index ?? 0}
              lotImages={currentLot ? (bestImages[currentLot.id] ?? []) : []}
              onOverrideAsk={handleOverrideAsk}
              onOverridePost={handleOverridePost}
              sessionStatus={controlsDisabled ? 'idle' : (session?.status ?? 'idle')}
              lotResult={currentLot ? (lotResults[currentLot.id] ?? null) : null}
            />
          </div>

          {/* Middle: auction history */}
          <div className="flex-1 overflow-hidden min-h-0 border-b border-ironbound-grey-700">
            <div className="grid grid-cols-2 h-full min-h-0">
              <div className="p-4 border-r border-ironbound-grey-700 flex flex-col min-h-0 overflow-hidden">
                <AuctionHistoryPanel
                  entries={historyLog}
                  onClear={() => setHistoryLog([])}
                />
              </div>
              <div className="bg-ironbound-grey-900 flex items-center justify-center">
                {anotherClerkActive && (
                  <div className="text-center px-6">
                    <ShieldAlert className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
                    <p className="text-yellow-500 text-sm font-semibold">Observing</p>
                    <p className="text-ironbound-grey-500 text-xs mt-1">
                      {session?.active_clerk_name} is clerking.<br />
                      Click "Take Over" to assume control.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom strip: undo + increments + lot result controls + catalog */}
          <div className={`flex-shrink-0 border-t border-ironbound-grey-700 transition-opacity ${controlsDisabled ? 'opacity-40 pointer-events-none' : ''}`} style={{ height: '200px' }}>
            <div className="grid grid-cols-[140px_1fr_1fr_1fr] h-full gap-0">
              <div className="p-3 border-r border-ironbound-grey-700 overflow-hidden flex flex-col">
                <BidUndoPanel
                  history={bidHistory}
                  onUndo={handleUndoBid}
                  disabled={session?.status !== 'running'}
                />
              </div>
              <div className="p-3 border-r border-ironbound-grey-700 overflow-hidden flex flex-col">
                <BidIncrementLadder
                  increments={increments}
                  selectedIncrement={selectedIncrement}
                  onIncrementClick={handleIncrementClick}
                  onIncrementDoubleClick={handleIncrementDoubleClick}
                  onSaveIncrements={handleSaveIncrements}
                  horizontal
                />
              </div>
              <div className="p-3 border-r border-ironbound-grey-700 overflow-hidden flex flex-col">
                <LotResultControls
                  sessionStatus={session?.status ?? 'idle'}
                  onFloorPriority={() => {}}
                  onAbsenteePriority={() => {}}
                  onSold={handleSold}
                  onConditional={handleConditional}
                  onFail={handleFail}
                  onPass={handlePass}
                  onUndo={() => {}}
                  onPauseLot={() => {}}
                  onOnce={() => {}}
                  onPrevLot={handlePrevLot}
                  onNextLot={handleNextLot}
                />
              </div>
              <div className="p-3 overflow-hidden flex flex-col">
                <LotCatalogPanel
                  lots={lots}
                  currentIndex={session?.current_lot_index ?? 0}
                  onSelectLot={handleSelectLot}
                  onPrevious={handlePrevLot}
                  onNext={handleNextLot}
                  sessionStatus={session?.status ?? 'idle'}
                  lotResults={lotResults}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right sidebar — messages */}
        <div className="bg-ironbound-grey-800 border-l border-ironbound-grey-700 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden p-3 min-h-0 flex flex-col gap-4">
            <div className={`flex-1 min-h-0 flex flex-col transition-opacity ${controlsDisabled ? 'opacity-40 pointer-events-none' : ''}`} style={{ maxHeight: '45%' }}>
              <MessagesPanel
                title="Messages — Online Bidders"
                placeholder="Message to online bidders..."
                onSend={(msg) => log('message_sent', `[Online] ${msg}`)}
                disabled={session?.status !== 'running'}
                presets={MESSAGE_PRESETS}
              />
            </div>

            <div className={`flex-1 min-h-0 flex flex-col transition-opacity ${controlsDisabled ? 'opacity-40 pointer-events-none' : ''}`} style={{ maxHeight: '45%' }}>
              <MessagesPanel
                title="Messages — Floor Projector"
                placeholder="Message to floor audience..."
                onSend={async (msg) => {
                  await log('message_sent', `[Projector] ${msg}`);
                  if (session) {
                    await LiveClerkService.updateSession(session.id, { projector_message: msg });
                  }
                }}
                disabled={session?.status !== 'running'}
                presets={PROJECTOR_PRESETS}
              />
            </div>
          </div>

          <div className="flex-shrink-0 border-t border-ironbound-grey-700 p-3 space-y-3">
            {/* Active clerk info panel */}
            <div className="bg-ironbound-grey-700/50 rounded-lg p-2.5">
              <div className="flex items-center gap-2 mb-1.5">
                <UserCheck className="h-3.5 w-3.5 text-ironbound-orange-400" />
                <span className="text-xs font-semibold text-ironbound-grey-300 uppercase tracking-wider">Clerk Control</span>
              </div>
              {session?.active_clerk_name ? (
                <div className="flex items-center gap-2">
                  <span className={`inline-block h-2 w-2 rounded-full flex-shrink-0 ${isActiveClerk ? 'bg-green-500' : 'bg-yellow-500'}`} />
                  <span className="text-xs text-ironbound-grey-300 truncate">
                    {session.active_clerk_name}
                    {isActiveClerk && <span className="text-green-400 ml-1">(you)</span>}
                  </span>
                </div>
              ) : (
                <div className="text-xs text-ironbound-grey-500 italic">No active clerk</div>
              )}
            </div>

            <div className="bg-ironbound-grey-700/50 rounded-lg p-2.5">
              <div className="flex items-center gap-2 mb-1.5">
                <Users className="h-3.5 w-3.5 text-ironbound-orange-400" />
                <span className="text-xs font-semibold text-ironbound-grey-300 uppercase tracking-wider">Interested Bidders</span>
              </div>
              <div className="text-xs text-ironbound-grey-500 italic py-1">No bidders connected yet</div>
            </div>

            <div className="bg-ironbound-grey-700/50 rounded-lg p-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Monitor className="h-3.5 w-3.5 text-ironbound-orange-400" />
                  <span className="text-xs text-ironbound-grey-300 font-semibold">Audience Projector</span>
                </div>
                <button
                  onClick={() => eventId && window.open(`/projector/${eventId}`, '_blank', 'noopener,noreferrer')}
                  className="text-xs text-ironbound-orange-400 hover:text-ironbound-orange-300 underline transition-colors"
                >
                  Open
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
