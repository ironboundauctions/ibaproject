@@ .. @@
  static async updateAuctionEvent(id: string, eventData: any): Promise<any> {
    console.log('EventService.updateAuctionEvent - updating event:', id, eventData);
    
    const events = this.getLocalEvents();
    const index = events.findIndex(e => e.id === id);
    
    if (index === -1) {
      throw new Error('Event not found');
    }
    
    const updatedEvent = {
      ...events[index],
      title: eventData.title,
      description: eventData.description,
      auction_type: eventData.auction_type,
      start_date: eventData.start_date,
      end_date: eventData.end_date,
      registration_start: eventData.registration_start,
      location: eventData.location,
      auctioneer: eventData.auctioneer,
      event_terms: eventData.event_terms,
      main_image_url: eventData.main_image_url,
      buyers_premium: eventData.buyers_premium,
      cc_card_fees: eventData.cc_card_fees,
      updated_at: new Date().toISOString(),
      // Update auction format fields too
      image_url: eventData.main_image_url || events[index].image_url,
      end_time: eventData.end_date
    };
    
    events[index] = updatedEvent;
    this.saveLocalEvents(events);
    
    console.log('EventService.updateAuctionEvent - successfully updated event:', updatedEvent);
    return updatedEvent;
  }