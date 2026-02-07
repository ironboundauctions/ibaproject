export interface AuctionFormData {
  title: string;
  description: string;
  starting_price: number;
  current_bid?: number;
  category: string;
  image_url: string;
  end_time: string;
  lot_number: string;
  reserve_price?: number;
  has_reserve: boolean;
  location: string;
  inspection_date?: string;
  specifications?: Record<string, string>;
  condition_report?: string;
  additional_images?: string[];
}

export interface AuctionEventFormData {
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  location: string;
  inspection_start: string;
  inspection_end: string;
  auctioneer_name: string;
  auctioneer_license: string;
}

export interface LotFormData {
  lot_number: string;
  title: string;
  description: string;
  category: string;
  starting_price: number;
  current_bid?: number;
  reserve_price?: number;
  has_reserve: boolean;
  image_url: string;
  additional_images?: string[];
  specifications?: Record<string, string>;
  condition_report?: string;
}

export interface AdminStats {
  total_auctions: number;
  active_auctions: number;
  total_bids: number;
  total_users: number;
  revenue: number;
}