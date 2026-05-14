import React, { useEffect, useState, useRef } from 'react';
import { Globe, Check, X, Zap, ZapOff, Bell } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { LiveClerkService, OnlineBid, LiveAuctionSession, BidIncrement } from '../../services/liveClerkService';
import { formatCurrency } from '../../utils/formatters';

interface Props {
  session: LiveAuctionSession;
  increments: BidIncrement[];
  onSessionUpdate: (updated: LiveAuctionSession) => void;
  onBidAccepted: (bid: OnlineBid, newCurrentBid: number, newAskingPrice: number) => void;
  disabled?: boolean;
}

export default function OnlineBidsPanel({ session, increments, onSessionUpdate, onBidAccepted, disabled }: Props) {
  const [pendingBids, setPendingBids] = useState<OnlineBid[]>([]);
  const [accepting, setAccepting] = useState<string | null>(null);

  // Refs so subscription callbacks always see fresh values without re-subscribing
  const acceptingRef = useRef<string | null>(null);
  const sessionRef = useRef(session);
  const incrementsRef = useRef(increments);
  const disabledRef = useRef(disabled);
  const onSessionUpdateRef = useRef(onSessionUpdate);
  const onBidAcceptedRef = useRef(onBidAccepted);
  sessionRef.current = session;
  incrementsRef.current = increments;
  disabledRef.current = disabled;
  onSessionUpdateRef.current = onSessionUpdate;
  onBidAcceptedRef.current = onBidAccepted;

  const isAuto = session.online_bid_mode === 'auto';

  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } catch {}
  };

  const getNextAskingPrice = (acceptedBidAmount: number): number => {
    const sess = sessionRef.current;
    // Use the same increment the clerk set: asking_price - current_bid
    // This preserves the clerk's chosen increment for all subsequent online bids
    const clerkIncrement =
      sess.asking_price && sess.current_bid != null
        ? sess.asking_price - sess.current_bid
        : null;

    if (clerkIncrement && clerkIncrement > 0) {
      return acceptedBidAmount + clerkIncrement;
    }

    // Fallback: pick the smallest configured increment
    const sorted = [...incrementsRef.current].sort((a, b) => a.amount - b.amount);
    return acceptedBidAmount + (sorted[0]?.amount ?? 100);
  };

  const handleAcceptRef = useRef(async (bid: OnlineBid) => {
    if (acceptingRef.current) return;
    acceptingRef.current = bid.id;
    setAccepting(bid.id);
    try {
      const sess = sessionRef.current;
      const newCurrentBid = bid.bid_amount;
      const newAskingPrice = getNextAskingPrice(newCurrentBid);

      // Update session — include high bidder so all online bidders are notified instantly
      const updated = await LiveClerkService.updateSession(sess.id, {
        current_bid: newCurrentBid,
        asking_price: newAskingPrice,
        current_high_bidder_id: bid.user_id,
      });

      // Mark bid as accepted
      await LiveClerkService.updateOnlineBidStatus(bid.id, 'accepted');

      // Supersede all other pending bids for this lot — read from DB to avoid stale state
      const pending = await LiveClerkService.getPendingOnlineBids(sess.id);
      for (const other of pending.filter(b => b.id !== bid.id)) {
        await LiveClerkService.updateOnlineBidStatus(other.id, 'superseded').catch(() => {});
      }

      setPendingBids([]);
      onBidAcceptedRef.current(bid, newCurrentBid, newAskingPrice);
      onSessionUpdateRef.current(updated);
    } catch (err: any) {
      alert(`Accept failed: ${err.message}`);
    } finally {
      acceptingRef.current = null;
      setAccepting(null);
    }
  });

  // Keep the ref's closure fresh for getNextAskingPrice (which reads incrementsRef)
  useEffect(() => {
    handleAcceptRef.current = async (bid: OnlineBid) => {
      if (acceptingRef.current) return;
      acceptingRef.current = bid.id;
      setAccepting(bid.id);
      try {
        const sess = sessionRef.current;
        const newCurrentBid = bid.bid_amount;
        const newAskingPrice = getNextAskingPrice(newCurrentBid);

        const updated = await LiveClerkService.updateSession(sess.id, {
          current_bid: newCurrentBid,
          asking_price: newAskingPrice,
          current_high_bidder_id: bid.user_id,
        });

        await LiveClerkService.updateOnlineBidStatus(bid.id, 'accepted');

        const pending = await LiveClerkService.getPendingOnlineBids(sess.id);
        for (const other of pending.filter(b => b.id !== bid.id)) {
          await LiveClerkService.updateOnlineBidStatus(other.id, 'superseded').catch(() => {});
        }

        setPendingBids([]);
        onBidAcceptedRef.current(bid, newCurrentBid, newAskingPrice);
        onSessionUpdateRef.current(updated);
      } catch (err: any) {
        alert(`Accept failed: ${err.message}`);
      } finally {
        acceptingRef.current = null;
        setAccepting(null);
      }
    };
  }); // runs every render so closure is always fresh

  // Load pending bids on mount
  useEffect(() => {
    if (!session?.id) return;
    LiveClerkService.getPendingOnlineBids(session.id).then(setPendingBids).catch(() => {});
  }, [session?.id]);

  // Subscribe to incoming bids — stable subscription, reads mode via ref
  useEffect(() => {
    if (!session?.id) return;

    const sub = LiveClerkService.subscribeToOnlineBids(session.id, async (bid) => {
      if (bid.status === 'pending') {
        setPendingBids(prev => {
          if (prev.some(b => b.id === bid.id)) return prev;
          return [...prev, bid];
        });
        playBeep();

        // Auto-accept: read mode from ref so this never goes stale
        if (sessionRef.current.online_bid_mode === 'auto' && !disabledRef.current) {
          await handleAcceptRef.current(bid);
        }
      } else {
        setPendingBids(prev => prev.filter(b => b.id !== bid.id));
      }
    });

    return () => { supabase?.removeChannel(sub); };
  }, [session?.id]); // stable — mode changes are picked up via sessionRef

  const handleAccept = (bid: OnlineBid) => handleAcceptRef.current(bid);

  const handleReject = async (bid: OnlineBid) => {
    await LiveClerkService.updateOnlineBidStatus(bid.id, 'rejected').catch(() => {});
    setPendingBids(prev => prev.filter(b => b.id !== bid.id));
  };

  const toggleMode = async () => {
    const newMode = isAuto ? 'manual' : 'auto';
    const updated = await LiveClerkService.updateSession(session.id, { online_bid_mode: newMode } as any);
    onSessionUpdate(updated);
  };

  return (
    <div className="bg-ironbound-grey-700/50 rounded-lg p-2.5 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Globe className="h-3.5 w-3.5 text-ironbound-orange-400 flex-shrink-0" />
          <span className="text-xs font-semibold text-ironbound-grey-300 uppercase tracking-wider">Online Bids</span>
          {pendingBids.length > 0 && (
            <span className="flex items-center justify-center h-4 w-4 rounded-full bg-ironbound-orange-500 text-white text-[10px] font-bold animate-pulse">
              {pendingBids.length}
            </span>
          )}
        </div>
        <button
          onClick={toggleMode}
          disabled={disabled}
          title={isAuto ? 'Auto-accept ON — click to switch to Manual' : 'Manual mode — click to switch to Auto-accept'}
          className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition-colors ${
            isAuto
              ? 'bg-green-800/60 border border-green-700 text-green-300 hover:bg-green-700/60'
              : 'bg-ironbound-grey-700 border border-ironbound-grey-600 text-ironbound-grey-400 hover:bg-ironbound-grey-600'
          } disabled:opacity-40`}
        >
          {isAuto ? <Zap className="h-3 w-3" /> : <ZapOff className="h-3 w-3" />}
          {isAuto ? 'Auto' : 'Manual'}
        </button>
      </div>

      {/* Pending bids list */}
      {pendingBids.length === 0 ? (
        <div className="text-[11px] text-ironbound-grey-600 italic py-1 text-center">
          No incoming online bids
        </div>
      ) : (
        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {pendingBids.map(bid => (
            <div
              key={bid.id}
              className="bg-ironbound-grey-800 border border-ironbound-orange-500/30 rounded-lg px-2.5 py-2 flex items-center gap-2"
            >
              <Bell className="h-3 w-3 text-ironbound-orange-400 flex-shrink-0 animate-pulse" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">{bid.bidder_name}</p>
                <p className="text-[11px] text-ironbound-orange-300 font-bold tabular-nums">
                  {formatCurrency(bid.bid_amount)}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => handleAccept(bid)}
                  disabled={!!accepting || disabled}
                  title="Accept bid"
                  className="p-1.5 rounded bg-green-700 hover:bg-green-600 text-white transition-colors disabled:opacity-40"
                >
                  <Check className="h-3 w-3" />
                </button>
                <button
                  onClick={() => handleReject(bid)}
                  disabled={!!accepting || disabled}
                  title="Reject bid"
                  className="p-1.5 rounded bg-ironbound-grey-600 hover:bg-red-700 text-ironbound-grey-300 hover:text-white transition-colors disabled:opacity-40"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
