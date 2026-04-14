import { supabase } from '../lib/supabase';

export class EventService {
  static async getAllEvents(): Promise<any[]> {
    const { data, error } = await supabase
      .from('auction_events')
      .select('*')
      .order('start_date', { ascending: true });

    if (error) throw new Error(error.message);
    return data || [];
  }

  static async getPublishedEvents(): Promise<any[]> {
    const { data, error } = await supabase
      .from('auction_events')
      .select('*, event_inventory_assignments(count)')
      .in('status', ['published', 'active', 'completed'])
      .order('start_date', { ascending: true });

    if (error) throw new Error(error.message);

    return (data || []).map((event: any) => ({
      ...event,
      total_lots: event.event_inventory_assignments?.[0]?.count ?? 0,
    }));
  }

  static async getEventById(id: string): Promise<any | null> {
    const { data, error } = await supabase
      .from('auction_events')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
  }

  static async generateEventNumber(): Promise<string> {
    const year = new Date().getFullYear();

    const { data, error } = await supabase.rpc('next_event_sequence', { p_year: year });
    if (error || data == null) {
      const { data: existing } = await supabase
        .from('auction_events')
        .select('event_number')
        .like('event_number', `${year}%`)
        .order('event_number', { ascending: false })
        .limit(1)
        .maybeSingle();
      const last = existing?.event_number ? parseInt(existing.event_number.slice(4), 10) : 0;
      return `${year}${String(last + 1).padStart(2, '0')}`;
    }
    return `${year}${String(data).padStart(2, '0')}`;
  }

  static async createAuctionEvent(eventData: any): Promise<any> {
    const event_number = await EventService.generateEventNumber();

    const row = {
      title: eventData.title,
      description: eventData.description,
      auction_type: eventData.auction_type || 'live',
      timezone: eventData.timezone || 'America/Chicago',
      start_date: eventData.start_date,
      end_date: eventData.end_date,
      registration_start: eventData.registration_start || eventData.start_date,
      location: eventData.location || '',
      auctioneer: eventData.auctioneer ? JSON.stringify(eventData.auctioneer) : null,
      event_terms: eventData.event_terms || '',
      main_image_url: eventData.main_image_url || '',
      buyers_premium: eventData.buyers_premium ?? 10,
      cc_card_fees: eventData.cc_card_fees ?? 3,
      bid_increment: eventData.bid_increment ?? 25,
      stream_url: eventData.stream_url || '',
      auto_accept_online_bids: eventData.auto_accept_online_bids ?? true,
      pre_bidding_enabled: eventData.pre_bidding_enabled ?? false,
      status: 'draft',
      event_number,
    };

    const { data, error } = await supabase
      .from('auction_events')
      .insert(row)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  static async updateAuctionEvent(id: string, eventData: any): Promise<any> {
    const row: any = {
      title: eventData.title,
      description: eventData.description,
      auction_type: eventData.auction_type,
      timezone: eventData.timezone,
      start_date: eventData.start_date,
      end_date: eventData.end_date,
      registration_start: eventData.registration_start || eventData.start_date,
      location: eventData.location,
      event_terms: eventData.event_terms,
      main_image_url: eventData.main_image_url,
      buyers_premium: eventData.buyers_premium,
      cc_card_fees: eventData.cc_card_fees,
      updated_at: new Date().toISOString(),
    };

    if (eventData.auctioneer !== undefined) {
      row.auctioneer = eventData.auctioneer ? JSON.stringify(eventData.auctioneer) : null;
    }
    if (eventData.bid_increment !== undefined) row.bid_increment = eventData.bid_increment;
    if (eventData.stream_url !== undefined) row.stream_url = eventData.stream_url;
    if (eventData.auto_accept_online_bids !== undefined) row.auto_accept_online_bids = eventData.auto_accept_online_bids;
    if (eventData.pre_bidding_enabled !== undefined) row.pre_bidding_enabled = eventData.pre_bidding_enabled;

    const { data, error } = await supabase
      .from('auction_events')
      .update(row)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  static async publishEvent(id: string): Promise<any> {
    const { data, error } = await supabase
      .from('auction_events')
      .update({ status: 'published', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  static async unpublishEvent(id: string): Promise<any> {
    const { data, error } = await supabase
      .from('auction_events')
      .update({ status: 'draft', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  static async deleteAuctionEvent(id: string): Promise<void> {
    const { error } = await supabase
      .from('auction_events')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);
  }

  static normalizeEventForDisplay(event: any): any {
    let auctioneer = event.auctioneer;
    if (typeof auctioneer === 'string') {
      try { auctioneer = JSON.parse(auctioneer); } catch { auctioneer = { name: auctioneer, license: '' }; }
    }

    return {
      ...event,
      auctioneer,
      is_event: true,
      image_url: event.main_image_url || 'https://images.pexels.com/photos/4386431/pexels-photo-4386431.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&dpr=2',
      end_time: event.end_date,
      starting_price: 0,
      current_bid: 0,
      category: 'Auction Event',
      bid_count: 0,
      lot_number: '',
      has_reserve: false,
      seller: { name: 'IronBound Auctions', joined_date: event.created_at, total_bids: 0, auctions_won: 0 },
      total_lots: event.total_lots ?? 0,
      registered_bidders: 0,
    };
  }

  // Legacy shims — kept so adminService.ts re-exports still compile
  static getLocalEvents(): any[] { return []; }
  static saveLocalEvents(_events: any[]): void { return; }
}
