import { supabase } from '../lib/supabase';
import { InventoryItem, EventAssignment } from './inventoryService';

export type SessionStatus = 'idle' | 'running' | 'paused' | 'ended';
export type LotResult = 'sold' | 'passed' | 'no_sale' | 'conditional';
export type BuyerType = 'floor' | 'absentee' | 'online';
export type HistoryEntryType =
  | 'auction_start'
  | 'auction_pause'
  | 'auction_resume'
  | 'auction_end'
  | 'lot_start'
  | 'lot_sold'
  | 'lot_passed'
  | 'bid_posted'
  | 'message_sent'
  | 'clerk_takeover'
  | 'system';

export interface LiveAuctionSession {
  id: string;
  event_id: string;
  status: SessionStatus;
  current_lot_id: string | null;
  current_lot_index: number;
  current_bid: number;
  asking_price: number;
  projector_message: string | null;
  projector_image_index: number;
  active_clerk_id: string | null;
  active_clerk_name: string | null;
  active_clerk_since: string | null;
  started_at: string | null;
  paused_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
  // Cloudflare Stream
  cf_stream_uid: string | null;
  cf_stream_whip_url: string | null;
  cf_stream_playback_url: string | null;
  cf_stream_status: string | null;
  // Online bidding
  online_bid_mode: 'auto' | 'manual';
  current_high_bidder_id: string | null;
}

export type OnlineBidStatus = 'pending' | 'accepted' | 'rejected' | 'superseded';

export interface OnlineBid {
  id: string;
  session_id: string;
  event_id: string;
  lot_id: string | null;
  lot_index: number;
  user_id: string;
  bidder_name: string;
  bid_amount: number;
  status: OnlineBidStatus;
  created_at: string;
  updated_at: string;
}

export interface BidIncrement {
  id: string;
  event_id: string | null;
  amount: number;
  display_order: number;
}

export interface HistoryLogEntry {
  id: string;
  session_id: string;
  event_id: string;
  entry_type: HistoryEntryType;
  message: string;
  metadata: Record<string, any> | null;
  clerk_id: string | null;
  clerk_name: string | null;
  created_at: string;
}

export type ClerkLot = InventoryItem & EventAssignment;

export interface LotResultEntry {
  id: string;
  session_id: string;
  event_id: string;
  inventory_item_id: string | null;
  lot_number: string | null;
  result: LotResult;
  sold_price: number | null;
  buyer_type: BuyerType | null;
  notes: string | null;
  updated_at: string;
  created_at: string;
}

export class LiveClerkService {
  static async getOrCreateSession(eventId: string): Promise<LiveAuctionSession> {
    const { data: existing, error: fetchError } = await supabase!
      .from('live_auction_sessions')
      .select('*')
      .eq('event_id', eventId)
      .neq('status', 'ended')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (existing) return existing as LiveAuctionSession;

    const { data: created, error: createError } = await supabase!
      .from('live_auction_sessions')
      .insert({ event_id: eventId, status: 'idle', current_lot_index: 0, current_bid: 0, asking_price: 0 })
      .select()
      .single();

    if (createError) throw createError;
    return created as LiveAuctionSession;
  }

  static async claimSession(sessionId: string, clerkId: string, clerkName: string): Promise<LiveAuctionSession> {
    const { data, error } = await supabase!
      .from('live_auction_sessions')
      .update({
        active_clerk_id: clerkId,
        active_clerk_name: clerkName,
        active_clerk_since: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw error;
    const updated = data as LiveAuctionSession;
    supabase!
      .channel(`projector_broadcast_${updated.event_id}`)
      .send({ type: 'broadcast', event: 'session_update', payload: updated });
    return updated;
  }

  static async releaseSession(sessionId: string): Promise<void> {
    const { error } = await supabase!
      .from('live_auction_sessions')
      .update({
        active_clerk_id: null,
        active_clerk_name: null,
        active_clerk_since: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (error) throw error;
  }

  static async updateSession(sessionId: string, fields: Partial<LiveAuctionSession>): Promise<LiveAuctionSession> {
    const { data, error } = await supabase!
      .from('live_auction_sessions')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw error;
    const updated = data as LiveAuctionSession;
    supabase!
      .channel(`projector_broadcast_${updated.event_id}`)
      .send({ type: 'broadcast', event: 'session_update', payload: updated });
    return updated;
  }

  static async startAuction(sessionId: string): Promise<LiveAuctionSession> {
    return this.updateSession(sessionId, { status: 'running', started_at: new Date().toISOString(), paused_at: null });
  }

  static async pauseAuction(sessionId: string): Promise<LiveAuctionSession> {
    return this.updateSession(sessionId, { status: 'paused', paused_at: new Date().toISOString() });
  }

  static async resumeAuction(sessionId: string): Promise<LiveAuctionSession> {
    return this.updateSession(sessionId, { status: 'running', paused_at: null });
  }

  static async stopAuction(sessionId: string): Promise<LiveAuctionSession> {
    return this.updateSession(sessionId, { status: 'ended', ended_at: new Date().toISOString() });
  }

  static async advanceToLot(sessionId: string, lotIndex: number, lotId: string, currentBid = 0, askingPrice = 0): Promise<LiveAuctionSession> {
    return this.updateSession(sessionId, { current_lot_index: lotIndex, current_lot_id: lotId, current_bid: currentBid, asking_price: askingPrice, current_high_bidder_id: null });
  }

  static async getBidIncrements(eventId: string): Promise<BidIncrement[]> {
    const { data: eventIncrements, error } = await supabase!
      .from('live_auction_bid_increments')
      .select('*')
      .eq('event_id', eventId)
      .order('display_order', { ascending: true });

    if (error) throw error;

    if (eventIncrements && eventIncrements.length > 0) {
      return eventIncrements as BidIncrement[];
    }

    const { data: defaults, error: defaultError } = await supabase!
      .from('live_auction_bid_increments')
      .select('*')
      .is('event_id', null)
      .order('display_order', { ascending: true });

    if (defaultError) throw defaultError;
    return (defaults || []) as BidIncrement[];
  }

  static async saveBidIncrements(eventId: string, amounts: number[]): Promise<void> {
    const { error: deleteError } = await supabase!
      .from('live_auction_bid_increments')
      .delete()
      .eq('event_id', eventId);

    if (deleteError) throw deleteError;

    const rows = amounts.map((amount, i) => ({ event_id: eventId, amount, display_order: i + 1 }));
    const { error: insertError } = await supabase!
      .from('live_auction_bid_increments')
      .insert(rows);

    if (insertError) throw insertError;
  }

  static async addHistoryEntry(
    sessionId: string,
    eventId: string,
    entryType: HistoryEntryType,
    message: string,
    metadata?: Record<string, any>,
    clerkId?: string,
    clerkName?: string
  ): Promise<HistoryLogEntry> {
    const { data, error } = await supabase!
      .from('live_auction_history_log')
      .insert({
        session_id: sessionId,
        event_id: eventId,
        entry_type: entryType,
        message,
        metadata: metadata || null,
        clerk_id: clerkId || null,
        clerk_name: clerkName || null,
      })
      .select()
      .single();

    if (error) throw error;
    return data as HistoryLogEntry;
  }

  static async getHistoryLog(sessionId: string): Promise<HistoryLogEntry[]> {
    const { data, error } = await supabase!
      .from('live_auction_history_log')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data || []) as HistoryLogEntry[];
  }

  static async getLotResults(sessionId: string): Promise<LotResultEntry[]> {
    const { data, error } = await supabase!
      .from('live_auction_lot_results')
      .select('*')
      .eq('session_id', sessionId)
      .order('updated_at', { ascending: true });

    if (error) throw error;
    return (data || []) as LotResultEntry[];
  }

  static async recordLotResult(
    sessionId: string,
    eventId: string,
    lot: ClerkLot,
    result: LotResult,
    soldPrice?: number,
    buyerType?: BuyerType,
    notes?: string
  ): Promise<void> {
    const { error } = await supabase!
      .from('live_auction_lot_results')
      .upsert(
        {
          session_id: sessionId,
          event_id: eventId,
          inventory_item_id: lot.id,
          lot_number: lot.lot_number,
          sale_order: lot.sale_order,
          result,
          sold_price: soldPrice ?? null,
          buyer_type: buyerType ?? null,
          notes: notes ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'session_id,inventory_item_id' }
      );

    if (error) throw error;
  }

  static async clearLotResult(sessionId: string, inventoryItemId: string): Promise<void> {
    const { error } = await supabase!
      .from('live_auction_lot_results')
      .delete()
      .eq('session_id', sessionId)
      .eq('inventory_item_id', inventoryItemId);

    if (error) throw error;
  }

  static subscribeToSession(sessionId: string, callback: (session: LiveAuctionSession) => void, channelSuffix = '') {
    return supabase!
      .channel(`live_session_${sessionId}${channelSuffix}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'live_auction_sessions',
        filter: `id=eq.${sessionId}`,
      }, (payload) => {
        callback(payload.new as LiveAuctionSession);
      })
      .subscribe();
  }

  static subscribeToHistory(sessionId: string, callback: (entry: HistoryLogEntry) => void) {
    return supabase!
      .channel(`live_history_${sessionId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_auction_history_log',
        filter: `session_id=eq.${sessionId}`,
      }, (payload) => {
        callback(payload.new as HistoryLogEntry);
      })
      .subscribe();
  }

  static subscribeToLotResults(sessionId: string, callback: (result: LotResultEntry) => void) {
    return supabase!
      .channel(`live_results_${sessionId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'live_auction_lot_results',
        filter: `session_id=eq.${sessionId}`,
      }, (payload) => {
        callback(payload.new as LotResultEntry);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'live_auction_lot_results',
        filter: `session_id=eq.${sessionId}`,
      }, (payload) => {
        callback(payload.new as LotResultEntry);
      })
      .subscribe();
  }

  static async submitOnlineBid(
    sessionId: string,
    eventId: string,
    lotId: string | null,
    lotIndex: number,
    userId: string,
    bidderName: string,
    bidAmount: number
  ): Promise<OnlineBid> {
    const { data, error } = await supabase!
      .from('online_bids')
      .insert({
        session_id: sessionId,
        event_id: eventId,
        lot_id: lotId,
        lot_index: lotIndex,
        user_id: userId,
        bidder_name: bidderName,
        bid_amount: bidAmount,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    const bid = data as OnlineBid;
    // Broadcast on the same channel the clerk subscribes to — instant delivery regardless of postgres_changes handshake timing
    supabase!
      .channel(`online_bids_${sessionId}`)
      .send({ type: 'broadcast', event: 'new_bid', payload: bid })
      .catch(() => {});
    return bid;
  }

  static async updateOnlineBidStatus(bidId: string, status: OnlineBidStatus, sessionId?: string, userId?: string): Promise<void> {
    const { error } = await supabase!
      .from('online_bids')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', bidId);

    if (error) throw error;

    // When accepting a bid, record the new high bidder on the session so all bidders are notified instantly
    if (status === 'accepted' && sessionId && userId) {
      await this.updateSession(sessionId, { current_high_bidder_id: userId });
    }
    // When rejecting/superseding, clear the high bidder if it was this user
    if ((status === 'rejected' || status === 'superseded') && sessionId) {
      const { data: bid } = await supabase!.from('online_bids').select('user_id').eq('id', bidId).maybeSingle();
      const { data: sess } = await supabase!.from('live_auction_sessions').select('current_high_bidder_id').eq('id', sessionId).maybeSingle();
      if (bid && sess && sess.current_high_bidder_id === bid.user_id) {
        await this.updateSession(sessionId, { current_high_bidder_id: null });
      }
    }
  }

  static async getPendingOnlineBids(sessionId: string): Promise<OnlineBid[]> {
    const { data, error } = await supabase!
      .from('online_bids')
      .select('*')
      .eq('session_id', sessionId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (data || []) as OnlineBid[];
  }

  static subscribeToOnlineBids(sessionId: string, callback: (bid: OnlineBid) => void) {
    const seenIds = new Set<string>();
    const dedup = (bid: OnlineBid) => {
      // For inserts/broadcasts deduplicate; always forward updates (status changes)
      if (bid.status !== 'pending') { callback(bid); return; }
      if (seenIds.has(bid.id)) return;
      seenIds.add(bid.id);
      callback(bid);
    };

    const channel = supabase!
      .channel(`online_bids_${sessionId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'online_bids',
        filter: `session_id=eq.${sessionId}`,
      }, (payload) => dedup(payload.new as OnlineBid))
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'online_bids',
        filter: `session_id=eq.${sessionId}`,
      }, (payload) => callback(payload.new as OnlineBid))
      .on('broadcast', { event: 'new_bid' }, ({ payload }) => dedup(payload as OnlineBid))
      .subscribe((status) => {
        // Once subscription is confirmed, re-fetch pending bids to catch anything that arrived during handshake
        if (status === 'SUBSCRIBED') {
          supabase!
            .from('online_bids')
            .select('*')
            .eq('session_id', sessionId)
            .eq('status', 'pending')
            .order('created_at', { ascending: true })
            .then(({ data }) => { (data || []).forEach(b => dedup(b as OnlineBid)); })
            .catch(() => {});
        }
      });

    return channel;
  }

  static async resetAuctionActivity(eventId: string): Promise<void> {
    const { data: sessions } = await supabase!
      .from('live_auction_sessions')
      .select('id')
      .eq('event_id', eventId);

    const sessionIds = (sessions || []).map((s: any) => s.id);

    if (sessionIds.length > 0) {
      const { error: historyErr } = await supabase!
        .from('live_auction_history_log')
        .delete()
        .in('session_id', sessionIds);
      if (historyErr) throw historyErr;

      const { error: resultsErr } = await supabase!
        .from('live_auction_lot_results')
        .delete()
        .in('session_id', sessionIds);
      if (resultsErr) throw resultsErr;

      const { error: sessionsErr } = await supabase!
        .from('live_auction_sessions')
        .delete()
        .eq('event_id', eventId);
      if (sessionsErr) throw sessionsErr;
    }

    const { error: preBidsErr } = await supabase!
      .from('pre_bids')
      .delete()
      .eq('event_id', eventId);
    if (preBidsErr) throw preBidsErr;

    const { error: assignErr } = await supabase!
      .from('event_inventory_assignments')
      .update({ lot_published: false })
      .eq('event_id', eventId);
    if (assignErr) throw assignErr;
  }
}
