import { supabase } from '../lib/supabase';

export interface PreBid {
  id: string;
  event_id: string;
  assignment_id: string;
  user_id: string;
  max_amount: number;
  status: 'active' | 'outbid' | 'won' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface CatalogLot {
  assignment_id: string;
  event_id: string;
  inventory_id: string;
  lot_number: string;
  sale_order: number;
  lot_notes: string;
  lot_starting_price: number | null;
  lot_published: boolean;
  title: string;
  description: string;
  category: string;
  image_url: string;
  additional_images: string[];
  condition: string;
  year_made: string | null;
  manufacturer: string | null;
  barcode_asset_group_id: string | null;
  buyer_attention: string | null;
  has_video: boolean;
  pre_bid: PreBid | null;
  pre_bid_count: number;
}

export class PreBidService {
  static async getEventLots(eventId: string, userId?: string): Promise<CatalogLot[]> {
    const { data, error } = await supabase
      .from('event_inventory_assignments')
      .select(`
        id,
        event_id,
        inventory_id,
        lot_number,
        sale_order,
        lot_notes,
        lot_starting_price,
        lot_published,
        inventory_items (
          title,
          description,
          category,
          image_url,
          additional_images,
          condition,
          year_made,
          manufacturer,
          barcode_asset_group_id,
          buyer_attention
        )
      `)
      .eq('event_id', eventId)
      .order('sale_order', { ascending: true });

    if (error) throw new Error(error.message);

    const lots: CatalogLot[] = (data || []).map((row: any) => {
      const item = row.inventory_items || {};
      let additionalImages: string[] = [];
      try {
        if (Array.isArray(item.additional_images)) additionalImages = item.additional_images;
        else if (typeof item.additional_images === 'string') additionalImages = JSON.parse(item.additional_images);
      } catch {}

      return {
        assignment_id: row.id,
        event_id: row.event_id,
        inventory_id: row.inventory_id,
        lot_number: row.lot_number,
        sale_order: row.sale_order,
        lot_notes: row.lot_notes || '',
        lot_starting_price: row.lot_starting_price ?? null,
        lot_published: row.lot_published !== false,
        title: item.title || 'Untitled',
        description: item.description || '',
        category: item.category || '',
        image_url: item.image_url || '',
        additional_images: additionalImages,
        condition: item.condition || '',
        year_made: item.year_made ?? null,
        manufacturer: item.manufacturer ?? null,
        barcode_asset_group_id: item.barcode_asset_group_id || null,
        buyer_attention: item.buyer_attention || null,
        has_video: false,
        pre_bid: null,
        pre_bid_count: 0,
      };
    });

    if (lots.length === 0) return lots;

    // Enrich with CDN images from auction_files — exclude barcode asset groups
    const inventoryIds = lots.map(l => l.inventory_id);
    const { data: files } = await supabase
      .from('auction_files')
      .select('item_id, cdn_url, variant, asset_group_id, display_order')
      .in('item_id', inventoryIds)
      .is('detached_at', null)
      .eq('published_status', 'published')
      .in('variant', ['thumb', 'display', 'video'])
      .order('display_order', { ascending: true, nullsFirst: false });

    const barcodeGroupMap = new Map(lots.map(l => [l.inventory_id, l.barcode_asset_group_id]));
    const thumbMap: Record<string, string> = {};
    const displayMap: Record<string, string> = {};
    const videoItemIds = new Set<string>();
    for (const file of files || []) {
      if (!file.cdn_url) continue;
      const barcodeGroupId = barcodeGroupMap.get(file.item_id);
      if (barcodeGroupId && file.asset_group_id === barcodeGroupId) continue;
      if (file.variant === 'thumb' && !thumbMap[file.item_id]) thumbMap[file.item_id] = file.cdn_url;
      else if (file.variant === 'display' && !displayMap[file.item_id]) displayMap[file.item_id] = file.cdn_url;
      else if (file.variant === 'video') videoItemIds.add(file.item_id);
    }
    lots.forEach(lot => {
      lot.image_url = thumbMap[lot.inventory_id] || displayMap[lot.inventory_id] || lot.image_url || '';
      lot.has_video = videoItemIds.has(lot.inventory_id);
    });

    const assignmentIds = lots.map(l => l.assignment_id);

    const { data: countData } = await supabase
      .from('pre_bids')
      .select('assignment_id')
      .eq('event_id', eventId)
      .eq('status', 'active');

    const counts = new Map<string, number>();
    (countData || []).forEach((row: any) => {
      counts.set(row.assignment_id, (counts.get(row.assignment_id) || 0) + 1);
    });
    lots.forEach(lot => { lot.pre_bid_count = counts.get(lot.assignment_id) || 0; });

    if (userId) {
      const { data: preBids } = await supabase
        .from('pre_bids')
        .select('*')
        .eq('user_id', userId)
        .in('assignment_id', assignmentIds);

      if (preBids) {
        const preBidMap = new Map(preBids.map((pb: PreBid) => [pb.assignment_id, pb]));
        lots.forEach(lot => { lot.pre_bid = preBidMap.get(lot.assignment_id) || null; });
      }
    }

    return lots;
  }

  static async setLotPublished(assignmentId: string, published: boolean): Promise<void> {
    const { error } = await supabase
      .from('event_inventory_assignments')
      .update({ lot_published: published })
      .eq('id', assignmentId);
    if (error) throw new Error(error.message);
  }

  static async setAllLotsPublished(eventId: string, published: boolean): Promise<void> {
    const { error } = await supabase
      .from('event_inventory_assignments')
      .update({ lot_published: published })
      .eq('event_id', eventId);
    if (error) throw new Error(error.message);
  }

  static async setSelectedLotsPublished(assignmentIds: string[], published: boolean): Promise<void> {
    const { error } = await supabase
      .from('event_inventory_assignments')
      .update({ lot_published: published })
      .in('id', assignmentIds);
    if (error) throw new Error(error.message);
  }

  static async placePreBid(eventId: string, assignmentId: string, maxAmount: number): Promise<PreBid> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: existing } = await supabase
      .from('pre_bids')
      .select('id')
      .eq('assignment_id', assignmentId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      const { data, error } = await supabase
        .from('pre_bids')
        .update({ max_amount: maxAmount, status: 'active', updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as PreBid;
    }

    const { data, error } = await supabase
      .from('pre_bids')
      .insert({ event_id: eventId, assignment_id: assignmentId, max_amount: maxAmount })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data as PreBid;
  }

  static async cancelPreBid(preBidId: string): Promise<void> {
    const { error } = await supabase
      .from('pre_bids')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', preBidId);
    if (error) throw new Error(error.message);
  }
}
