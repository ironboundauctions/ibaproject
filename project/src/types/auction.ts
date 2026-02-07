export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: string;
  joined_date?: string;
  total_bids?: number;
  auctions_won?: number;
}

export interface Seller extends AuthUser {
  joined_date: string;
  total_bids: number;
  auctions_won: number;
}

export interface Auctioneer {
  name: string;
  license: string;
}

export interface AuctionEvent {
  id: string;
  title: string;
  description: string;
  auction_type: 'live' | 'timed';
  timezone: string;
  start_date: string;
  end_date: string;
  registration_start: string;
  location: string;
  inspection_start: string;
  inspection_end: string;
  auctioneer: Auctioneer;
  event_terms: string;
  main_image_url?: string;
  buyers_premium: number;
  cc_card_fees: number;
  status: 'upcoming' | 'active' | 'ended' | 'cancelled';
  created_at: string;
  lots: AuctionLot[];
  total_lots: number;
  highest_bid: number;
  total_bids: number;
}

export interface AuctionLot {
  id: string;
  auction_event_id: string;
  lot_number: string;
  title: string;
  description: string;
  category: string;
  starting_price: number;
  current_bid: number;
  reserve_price?: number;
  has_reserve: boolean;
  image_url: string;
  additional_images?: string[];
  specifications?: Record<string, string>;
  condition_report?: string;
  bid_count: number;
  status: 'active' | 'sold' | 'passed';
  created_at: string;
  consigner?: {
    name: string;
    email?: string;
    phone?: string;
  };
  estimated_value?: {
    low: number;
    high: number;
  };
}

export interface Auction {
  id: string;
  title: string;
  description: string;
  starting_price: number;
  current_bid: number;
  category: string;
  image_url: string;
  end_time: string;
  seller: Seller;
  bid_count: number;
  status: 'active' | 'ended' | 'cancelled';
  created_at: string;
  lot_number: string;
  reserve_price?: number;
  has_reserve: boolean;
  additional_images?: string[];
  inspection_date?: string;
  location: string;
  auctioneer?: Auctioneer;
  specifications?: Record<string, string>;
  condition_report?: string;
}

export interface Bid {
  id: string;
  auction_id: string;
  user: AuthUser;
  amount: number;
  timestamp: string;
}

export type AuctionCategory = 
  | 'Construction Equipment'
  | 'Agricultural Equipment'
  | 'Semi-Trucks'
  | 'Cars & Trucks'
  | 'Heavy Machinery'
  | 'Real Estate'
  | 'General Consignment';