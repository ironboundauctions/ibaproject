import { AuctionEvent } from '../types/auction';

// Local storage for auction events
const EVENTS_STORAGE_KEY = 'ironbound_auction_events';

export class EventService {
  static getLocalEvents(): any[] {
    try {
      const stored = localStorage.getItem(EVENTS_STORAGE_KEY);
      const events = stored ? JSON.parse(stored) : [];
      return events;
    } catch (error) {
      console.error('Error loading events from localStorage:', error);
      return [];
    }
  }

  static saveLocalEvents(events: any[]): void {
    try {
      localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(events));
    } catch (error) {
      console.error('Error saving events to localStorage:', error);
      throw new Error('Failed to save event data');
    }
  }

  static async createAuctionEvent(eventData: any): Promise<any> {
    const events = this.getLocalEvents();
    
    const newEvent = {
      id: crypto.randomUUID(),
      title: eventData.title,
      description: eventData.description,
      auction_type: eventData.auction_type || 'live',
      timezone: eventData.timezone || 'America/New_York',
      start_date: eventData.start_date,
      end_date: eventData.end_date,
      registration_start: eventData.registration_start,
      location: eventData.location,
      auctioneer: eventData.auctioneer,
      event_terms: eventData.event_terms || '',
      main_image_url: eventData.main_image_url || '',
      buyers_premium: eventData.buyers_premium || 10,
      cc_card_fees: eventData.cc_card_fees || 3,
      status: 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      lots: [],
      total_lots: 0,
      highest_bid: 0,
      total_bids: 0,
      // Convert to auction format for compatibility
      starting_price: null,
      current_bid: null,
      category: 'Auction Event',
      image_url: eventData.main_image_url || 'https://images.pexels.com/photos/4386431/pexels-photo-4386431.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&dpr=2',
      end_time: eventData.end_date,
      seller: { 
        name: 'IronBound Auctions',
        joined_date: new Date().toISOString(),
        total_bids: 0,
        auctions_won: 0
      },
      bid_count: 0,
      lot_number: `EVENT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
      has_reserve: false,
      // Event-specific fields to distinguish from regular auctions
      is_event: true,
      registered_bidders: 0
    };
    
    events.push(newEvent);
    this.saveLocalEvents(events);
    
    return newEvent;
  }

  static async updateAuctionEvent(id: string, eventData: any): Promise<any> {
    console.log('🔄 EventService.updateAuctionEvent - updating event:', id);
    console.log('📥 EventService.updateAuctionEvent - EXACT incoming dates:', {
      start_date: eventData.start_date,
      end_date: eventData.end_date,
      registration_start: eventData.registration_start
    });
    
    const events = this.getLocalEvents();
    const index = events.findIndex(e => e.id === id);
    
    if (index === -1) {
      throw new Error('Event not found');
    }
    
    console.log('📋 EventService.updateAuctionEvent - current stored dates:', {
      start_date: events[index].start_date,
      end_date: events[index].end_date,
      registration_start: events[index].registration_start
    });
    
    // Store dates EXACTLY as received - no processing at all
    const updatedEvent = {
      ...events[index],
      title: eventData.title,
      description: eventData.description,
      auction_type: eventData.auction_type,
      timezone: eventData.timezone,
      start_date: eventData.start_date,  // EXACT copy
      end_date: eventData.end_date,      // EXACT copy
      registration_start: eventData.registration_start, // EXACT copy
      location: eventData.location,
      auctioneer: eventData.auctioneer,
      event_terms: eventData.event_terms,
      main_image_url: eventData.main_image_url,
      buyers_premium: eventData.buyers_premium,
      cc_card_fees: eventData.cc_card_fees,
      updated_at: new Date().toISOString(),
      // Update auction format fields too
      image_url: eventData.main_image_url || events[index].image_url,
      end_time: eventData.end_date,
      is_event: true
    };
    
    console.log('💾 EventService.updateAuctionEvent - EXACT dates being saved:', {
      start_date: updatedEvent.start_date,
      end_date: updatedEvent.end_date,
      registration_start: updatedEvent.registration_start
    });
    
    events[index] = updatedEvent;
    this.saveLocalEvents(events);
    
    console.log('✅ EventService.updateAuctionEvent - successfully updated event');
    return updatedEvent;
  }

  static async deleteAuctionEvent(id: string): Promise<void> {
    console.log('EventService.deleteAuctionEvent - deleting event:', id);
    
    const events = this.getLocalEvents();
    const filteredEvents = events.filter(e => e.id !== id);
    
    if (filteredEvents.length === events.length) {
      throw new Error('Event not found');
    }
    
    this.saveLocalEvents(filteredEvents);
    console.log('EventService.deleteAuctionEvent - successfully deleted event');
  }
}