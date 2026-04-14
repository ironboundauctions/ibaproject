import { supabase, hasSupabaseCredentials } from '../lib/supabase';
import { EventService } from './eventService';
import { StatsService } from './statsService';
import { LotService } from './lotService';

export class AdminService {
  // Re-export event methods for backward compatibility
  static getLocalEvents = EventService.getLocalEvents;
  static saveLocalEvents = EventService.saveLocalEvents;
  static createAuctionEvent = EventService.createAuctionEvent.bind(EventService);
  static updateAuctionEvent = EventService.updateAuctionEvent.bind(EventService);
  static deleteAuctionEvent = EventService.deleteAuctionEvent.bind(EventService);
  static publishEvent = EventService.publishEvent.bind(EventService);
  static unpublishEvent = EventService.unpublishEvent.bind(EventService);

  // Re-export stats methods
  static getAdminStats = StatsService.getAdminStats;

  // Re-export lot methods
  static addLotToAuction = LotService.addLotToAuction;
  static getLotsForAuction = LotService.getLotsForAuction;
  static updateLot = LotService.updateLot;
  static deleteLot = LotService.deleteLot;

  static normalizeEvent = EventService.normalizeEventForDisplay;

  static async getAllAuctions(): Promise<any[]> {
    if (!hasSupabaseCredentials()) return [];

    try {
      const events = await EventService.getAllEvents();
      return events.map(EventService.normalizeEventForDisplay);
    } catch (error) {
      console.error('Error fetching events from Supabase:', error);
      return [];
    }
  }

  static async getPublishedAuctions(): Promise<any[]> {
    if (!hasSupabaseCredentials()) return [];

    try {
      const events = await EventService.getPublishedEvents();
      return events.map(EventService.normalizeEventForDisplay);
    } catch (error) {
      console.error('Error fetching published events:', error);
      return [];
    }
  }
}
