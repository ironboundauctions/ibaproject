import { supabase, hasSupabaseCredentials } from '../lib/supabase';
import { EventService } from './eventService';
import { StatsService } from './statsService';
import { LotService } from './lotService';

export class AdminService {
  // Re-export event methods for backward compatibility
  static getLocalEvents = EventService.getLocalEvents;
  static saveLocalEvents = EventService.saveLocalEvents;
  static createAuctionEvent = EventService.createAuctionEvent;
  static updateAuctionEvent = EventService.updateAuctionEvent;
  static deleteAuctionEvent = EventService.deleteAuctionEvent;

  // Re-export stats methods
  static getAdminStats = StatsService.getAdminStats;

  // Re-export lot methods
  static addLotToAuction = LotService.addLotToAuction;
  static getLotsForAuction = LotService.getLotsForAuction;
  static updateLot = LotService.updateLot;
  static deleteLot = LotService.deleteLot;

  static async getAllAuctions(): Promise<any[]> {
    // Return local events as "auctions" for the admin panel
    const localEvents = EventService.getLocalEvents();
    
    // Also get any real auctions from database if connected
    let dbAuctions: any[] = [];
    if (hasSupabaseCredentials()) {
      try {
        const { data, error } = await supabase
          .from('auctions')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (!error && data) {
          dbAuctions = data;
        }
      } catch (error) {
      }
    }
    
    // Combine local events and database auctions
    const combined = [...localEvents, ...dbAuctions];
    return combined;
  }
}