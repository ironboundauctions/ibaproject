import { Auction, Bid } from '../types/auction';

interface CreateAuctionData {
  title: string;
  description: string;
  starting_price: number;
  category: string;
  image_url: string;
  lot_number?: string;
  additional_images?: string[];
  consigner_id?: string | null;
}

export class AuctionService {
  private static STORAGE_KEY = 'ironbound_auctions';
  private static BIDS_STORAGE_KEY = 'ironbound_bids';

  static getAuctions(): Auction[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      const auctions = stored ? JSON.parse(stored) : [];
      return auctions.filter((a: Auction) => a.status === 'active');
    } catch (error) {
      console.error('Error loading auctions:', error);
      return [];
    }
  }

  static saveAuctions(auctions: Auction[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(auctions));
    } catch (error) {
      console.error('Error saving auctions:', error);
      throw new Error('Failed to save auction data');
    }
  }

  static async getAuction(id: string): Promise<Auction | null> {
    const auctions = this.getAuctions();
    return auctions.find(a => a.id === id) || null;
  }

  static async createAuction(auctionData: CreateAuctionData): Promise<Auction> {
    const auctions = this.getAuctions();

    const newAuction: Auction = {
      id: crypto.randomUUID(),
      title: auctionData.title,
      description: auctionData.description,
      starting_price: auctionData.starting_price,
      current_price: auctionData.starting_price,
      category: auctionData.category,
      image_url: auctionData.image_url,
      lot_number: auctionData.lot_number,
      additional_images: auctionData.additional_images,
      consigner_id: auctionData.consigner_id,
      seller_id: 'local-admin',
      status: 'active',
      end_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    auctions.push(newAuction);
    this.saveAuctions(auctions);

    return newAuction;
  }

  static async placeBid(auctionId: string, amount: number): Promise<void> {
    const auctions = this.getAuctions();
    const auction = auctions.find(a => a.id === auctionId);

    if (!auction) {
      throw new Error('Auction not found');
    }

    if (amount <= auction.current_price) {
      throw new Error('Bid must be higher than current price');
    }

    auction.current_price = amount;
    auction.updated_at = new Date().toISOString();
    this.saveAuctions(auctions);

    const bids = this.getBidsFromStorage();
    bids.push({
      id: crypto.randomUUID(),
      auction_id: auctionId,
      bidder_id: 'anonymous',
      amount,
      created_at: new Date().toISOString()
    });
    this.saveBids(bids);
  }

  static async getBidHistory(auctionId: string): Promise<Bid[]> {
    const bids = this.getBidsFromStorage();
    return bids
      .filter(b => b.auction_id === auctionId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  private static getBidsFromStorage(): Bid[] {
    try {
      const stored = localStorage.getItem(this.BIDS_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading bids:', error);
      return [];
    }
  }

  private static saveBids(bids: Bid[]): void {
    try {
      localStorage.setItem(this.BIDS_STORAGE_KEY, JSON.stringify(bids));
    } catch (error) {
      console.error('Error saving bids:', error);
      throw new Error('Failed to save bid data');
    }
  }
}
