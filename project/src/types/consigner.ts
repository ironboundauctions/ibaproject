export interface Consigner {
  id: string;
  customer_number: string; // Format: A0001, B0002, etc.
  full_name: string;
  nickname?: string;
  company?: string;
  address: string;
  email?: string;
  phone: string;
  created_at: string;
  updated_at: string;
  total_items: number;
  active_items: number;
}

export interface ConsignerFormData {
  customer_number: string;
  full_name: string;
  nickname: string;
  company: string;
  address: string;
  email: string;
  phone: string;
}

export interface InventoryItem {
  id: string;
  inventory_number: string; // Format: 525001, 525002, etc.
  event_id: string;
  consigner_customer_number: string;
  title: string;
  description: string;
  additional_description?: string;
  reserve_price?: number;
  category?: string;
  condition?: string;
  estimated_value?: {
    low: number;
    high: number;
  };
  image_url?: string;
  additional_images?: string[];
  specifications?: Record<string, string>;
  status: 'cataloged' | 'assigned_to_auction' | 'live' | 'sold' | 'paid' | 'picked_up' | 'returned';
  lot_number?: string; // Assigned when "Create Lots" is pressed
  sale_order?: number; // For drag-drop organization
  created_at: string;
  updated_at: string;
}

export interface InventoryItemFormData {
  inventory_number: string;
  consigner_customer_number: string;
  title: string;
  description: string;
  additional_description: string;
  reserve_price: string;
  category: string;
  condition: string;
  estimated_value_low: string;
  estimated_value_high: string;
  image_url: string;
  additional_images: string;
  specifications: { key: string; value: string }[];
}