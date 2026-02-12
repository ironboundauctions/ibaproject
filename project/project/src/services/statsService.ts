import { supabase, hasSupabaseCredentials } from '../lib/supabase';
import { AdminStats } from '../types/admin';
import { EventService } from './eventService';

export class StatsService {
  static async getAdminStats(): Promise<AdminStats> {
    // Get stats from local events and any database auctions
    const localEvents = EventService.getLocalEvents();
    
    let dbStats = { auctions: 0, users: 0, bids: 0 };
    
    if (hasSupabaseCredentials()) {
      try {
        const { data: auctions } = await supabase
          .from('auctions')
          .select('status, bid_count');
        
        const { data: users } = await supabase
          .from('profiles')
          .select('id');
          
        dbStats = {
          auctions: auctions?.length || 0,
          users: users?.length || 0,
          bids: auctions?.reduce((sum, a) => sum + (a.bid_count || 0), 0) || 0
        };
      } catch (error) {
        console.error('Error fetching database stats:', error);
      }
    }

    return {
      total_auctions: localEvents.length + dbStats.auctions,
      active_auctions: localEvents.filter(e => e.status === 'active').length,
      total_bids: dbStats.bids,
      total_users: dbStats.users,
      revenue: 0 // Would need to calculate from completed auctions
    };
  }
}