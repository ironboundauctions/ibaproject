import { supabase } from '../lib/supabase';

export interface DocumentImage {
  url: string;
  assetGroupId: string;
}

export interface EventAssignment {
  assignment_id?: string;
  lot_number: string;
  sale_order: number;
  lot_notes: string;
  lot_starting_price: number | null;
}

export interface InventoryItem {
  id: string;
  inventory_number: string;
  title: string;
  description?: string;
  category: string;
  starting_price: number;
  reserve_price?: number;
  estimated_value_low?: number;
  estimated_value_high?: number;
  image_url: string;
  additional_images?: string[];
  consigner_id?: string;
  condition?: string;
  dimensions?: string;
  weight?: string;
  manufacturer?: string;
  year_made?: string;
  notes?: string;
  barcode_image_url?: string;
  barcode_asset_group_id?: string;
  document_urls?: DocumentImage[];
  has_title?: boolean;
  buyer_attention?: string;
  status: 'cataloged' | 'assigned_to_auction' | 'live' | 'sold' | 'paid' | 'picked_up' | 'returned';
  created_at: string;
  updated_at: string;
}

export interface CreateInventoryItemData {
  id?: string;
  inventory_number: string;
  title: string;
  description?: string;
  category: string;
  starting_price: number;
  reserve_price?: number;
  estimated_value_low?: number;
  estimated_value_high?: number;
  image_url?: string;
  additional_images?: string[];
  consigner_id?: string;
  condition?: string;
  dimensions?: string;
  weight?: string;
  manufacturer?: string;
  year_made?: string;
  notes?: string;
  barcode_image_url?: string;
  barcode_asset_group_id?: string;
  document_urls?: DocumentImage[];
  has_title?: boolean;
  buyer_attention?: string;
}

const FALLBACK_IMAGE = 'https://images.pexels.com/photos/1078884/pexels-photo-1078884.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&dpr=2';

async function enrichItemsWithImages(items: InventoryItem[]): Promise<InventoryItem[]> {
  if (items.length === 0) return items;

  const ids = items.map(i => i.id);

  const barcodeAssetGroupIds = new Map(
    items
      .filter(i => i.barcode_asset_group_id)
      .map(i => [i.id, i.barcode_asset_group_id!])
  );

  const { data: files } = await supabase
    .from('auction_files')
    .select('item_id, cdn_url, variant, asset_group_id, display_order')
    .in('item_id', ids)
    .is('detached_at', null)
    .eq('published_status', 'published')
    .in('variant', ['thumb', 'display'])
    .order('display_order', { ascending: true, nullsFirst: false });

  const thumbMap: Record<string, string> = {};
  const displayMap: Record<string, string> = {};

  for (const file of files || []) {
    if (!file.cdn_url) continue;
    const barcodeGroupId = barcodeAssetGroupIds.get(file.item_id);
    if (barcodeGroupId && file.asset_group_id === barcodeGroupId) continue;

    if (file.variant === 'thumb' && !thumbMap[file.item_id]) thumbMap[file.item_id] = file.cdn_url;
    else if (file.variant === 'display' && !displayMap[file.item_id]) displayMap[file.item_id] = file.cdn_url;
  }

  return items.map(item => ({
    ...item,
    image_url: thumbMap[item.id] || displayMap[item.id] || item.image_url || FALLBACK_IMAGE
  }));
}

export class InventoryService {
  static async getAllItems(): Promise<InventoryItem[]> {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  static async getAvailableItems(): Promise<InventoryItem[]> {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('status', 'cataloged')
      .is('deleted_at', null)
      .order('inventory_number', { ascending: true });

    if (error) throw error;
    return enrichItemsWithImages(data || []);
  }

  static async getAllItemsForEventModal(): Promise<InventoryItem[]> {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .is('deleted_at', null)
      .order('inventory_number', { ascending: true });

    if (error) throw error;
    return enrichItemsWithImages(data || []);
  }

  static async getItemById(id: string): Promise<InventoryItem | null> {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async getItemByInventoryNumber(inventoryNumber: string): Promise<InventoryItem | null> {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('inventory_number', inventoryNumber)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  static async createItem(itemData: CreateInventoryItemData): Promise<InventoryItem> {
    const existing = await this.getItemByInventoryNumber(itemData.inventory_number);
    if (existing) {
      throw new Error(`Item with inventory number ${itemData.inventory_number} already exists`);
    }

    const { data, error } = await supabase
      .from('inventory_items')
      .insert({
        ...itemData,
        status: 'cataloged',
        image_url: itemData.image_url || 'https://images.pexels.com/photos/1078884/pexels-photo-1078884.jpeg?auto=compress&cs=tinysrgb&w=800&h=600&dpr=2'
      })
      .select()
      .single();

    if (error) {
      console.error('[INVENTORY] Database insert error:', error);
      console.error('[INVENTORY] Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw error;
    }
    return data;
  }

  static async updateItem(id: string, updates: Partial<CreateInventoryItemData>): Promise<InventoryItem> {
    const { data, error } = await supabase
      .from('inventory_items')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async deleteItem(id: string): Promise<void> {
    console.log(`[INVENTORY] Soft-deleting inventory item ${id}`);

    const { error } = await supabase
      .from('inventory_items')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    console.log(`[INVENTORY] Item soft-deleted successfully with all files intact.`);
  }

  static async removeAllEventAssignments(inventoryId: string): Promise<void> {
    const { error } = await supabase
      .from('event_inventory_assignments')
      .delete()
      .eq('inventory_id', inventoryId);

    if (error) throw error;
  }

  static async assignToEvent(inventoryId: string, eventId: string, saleOrder: number): Promise<void> {
    console.log('[assignToEvent] updating status for', inventoryId);
    const { error: updateError } = await supabase
      .from('inventory_items')
      .update({ status: 'assigned_to_auction' })
      .eq('id', inventoryId);

    if (updateError) {
      console.error('[assignToEvent] status update failed:', updateError);
      throw updateError;
    }

    console.log('[assignToEvent] inserting assignment for', inventoryId, 'event', eventId);
    const { error: assignError } = await supabase
      .from('event_inventory_assignments')
      .insert({
        event_id: eventId,
        inventory_id: inventoryId,
        lot_number: null,
        sale_order: saleOrder
      });

    if (assignError) {
      console.error('[assignToEvent] insert failed:', assignError);
      throw assignError;
    }
  }

  static async generateLotNumbers(eventId: string): Promise<void> {
    const { data, error } = await supabase
      .from('event_inventory_assignments')
      .select('id, sale_order')
      .eq('event_id', eventId)
      .order('sale_order', { ascending: true });

    if (error) throw error;

    const updates = (data || []).map((row: any, index: number) => ({
      id: row.id,
      lot_number: `LOT ${index + 1}`,
      sale_order: index + 1,
    }));

    for (const update of updates) {
      const { error: updateError } = await supabase
        .from('event_inventory_assignments')
        .update({ lot_number: update.lot_number, sale_order: update.sale_order })
        .eq('id', update.id);
      if (updateError) throw updateError;
    }
  }

  static async unassignFromEvent(inventoryId: string, eventId: string): Promise<void> {
    const { error: deleteError } = await supabase
      .from('event_inventory_assignments')
      .delete()
      .eq('inventory_id', inventoryId)
      .eq('event_id', eventId);

    if (deleteError) throw deleteError;

    const { data: otherAssignments } = await supabase
      .from('event_inventory_assignments')
      .select('id')
      .eq('inventory_id', inventoryId);

    if (!otherAssignments || otherAssignments.length === 0) {
      const { error: updateError } = await supabase
        .from('inventory_items')
        .update({ status: 'cataloged' })
        .eq('id', inventoryId);

      if (updateError) throw updateError;
    }
  }

  static async getItemsForEvent(eventId: string): Promise<(InventoryItem & EventAssignment)[]> {
    const { data, error } = await supabase
      .from('event_inventory_assignments')
      .select(`
        id,
        inventory_id,
        lot_number,
        sale_order,
        lot_notes,
        lot_starting_price,
        inventory_items (*)
      `)
      .eq('event_id', eventId)
      .order('sale_order', { ascending: true });

    if (error) throw error;

    const items = (data || []).map((assignment: any) => ({
      ...assignment.inventory_items,
      assignment_id: assignment.id,
      lot_number: assignment.lot_number,
      sale_order: assignment.sale_order,
      lot_notes: assignment.lot_notes ?? '',
      lot_starting_price: assignment.lot_starting_price ?? null,
    }));
    return enrichItemsWithImages(items) as Promise<(InventoryItem & EventAssignment)[]>;
  }

  static async getBestQualityImagesForItems(itemIds: string[], barcodeGroupIds?: Map<string, string>): Promise<Record<string, string[]>> {
    if (itemIds.length === 0) return {};

    let barcodeMap = barcodeGroupIds;
    if (!barcodeMap) {
      const { data: itemRows } = await supabase
        .from('inventory_items')
        .select('id, barcode_asset_group_id')
        .in('id', itemIds)
        .not('barcode_asset_group_id', 'is', null);
      barcodeMap = new Map(
        (itemRows || []).map((r: any) => [r.id, r.barcode_asset_group_id])
      );
    }

    const { data: files } = await supabase
      .from('auction_files')
      .select('item_id, cdn_url, variant, asset_group_id, display_order')
      .in('item_id', itemIds)
      .is('detached_at', null)
      .eq('published_status', 'published')
      .in('variant', ['source', 'display', 'thumb'])
      .order('display_order', { ascending: true, nullsFirst: false });

    const VARIANT_PRIORITY: Record<string, number> = { source: 0, display: 1, thumb: 2 };

    const groupMap: Record<string, Map<string, { url: string; variant: string; order: number }>> = {};

    for (const file of files || []) {
      if (!file.cdn_url) continue;
      const barcodeGroupId = barcodeMap?.get(file.item_id);
      if (barcodeGroupId && file.asset_group_id === barcodeGroupId) continue;

      if (!groupMap[file.item_id]) groupMap[file.item_id] = new Map();
      const groupId = file.asset_group_id ?? file.cdn_url;
      const existing = groupMap[file.item_id].get(groupId);
      const priority = VARIANT_PRIORITY[file.variant] ?? 99;
      if (!existing || priority < (VARIANT_PRIORITY[existing.variant] ?? 99)) {
        groupMap[file.item_id].set(groupId, { url: file.cdn_url, variant: file.variant, order: file.display_order ?? 9999 });
      }
    }

    const result: Record<string, string[]> = {};
    for (const itemId of itemIds) {
      const entries = groupMap[itemId] ? Array.from(groupMap[itemId].values()) : [];
      entries.sort((a, b) => a.order - b.order);
      result[itemId] = entries.map(e => e.url);
    }
    return result;
  }

  static async updateEventAssignment(
    assignmentId: string,
    fields: Partial<EventAssignment>
  ): Promise<void> {
    const { error } = await supabase
      .from('event_inventory_assignments')
      .update(fields)
      .eq('id', assignmentId);

    if (error) throw error;
  }

  static async getItemMedia(itemId: string): Promise<Array<{
    id: string;
    url: string;
    thumbUrl?: string;
    displayUrl?: string;
    isVideo: boolean;
    publishStatus?: string;
    name?: string;
  }>> {
    const { data, error } = await supabase
      .from('auction_files')
      .select('id, cdn_url, mime_type, original_name, published_status, variant')
      .eq('item_id', itemId)
      .is('detached_at', null)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[INVENTORY] Error fetching media:', error);
      return [];
    }

    return (data || []).map(file => ({
      id: file.id,
      url: file.cdn_url || '',
      thumbUrl: undefined,
      displayUrl: file.cdn_url || undefined,
      isVideo: file.mime_type?.startsWith('video/') || false,
      publishStatus: file.published_status || undefined,
      name: file.original_name || undefined
    }));
  }

  static async getItemEventAssignments(inventoryId: string): Promise<Array<{
    assignment_id: string;
    event_id: string;
    lot_number: string;
    sale_order: number;
    lot_notes: string;
    lot_starting_price: number | null;
    assigned_at: string;
    event: {
      id: string;
      title: string;
      start_date: string;
      end_date: string;
      status: string;
      location: string;
    };
  }>> {
    const { data, error } = await supabase
      .from('event_inventory_assignments')
      .select(`
        id,
        event_id,
        lot_number,
        sale_order,
        lot_notes,
        lot_starting_price,
        assigned_at,
        auction_events (
          id,
          title,
          start_date,
          end_date,
          status,
          location
        )
      `)
      .eq('inventory_id', inventoryId)
      .order('assigned_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((row: any) => ({
      assignment_id: row.id,
      event_id: row.event_id,
      lot_number: row.lot_number,
      sale_order: row.sale_order,
      lot_notes: row.lot_notes ?? '',
      lot_starting_price: row.lot_starting_price ?? null,
      assigned_at: row.assigned_at,
      event: row.auction_events,
    }));
  }

  static async restoreItem(itemId: string): Promise<void> {
    try {
      console.log('[INVENTORY] Restoring item:', itemId);

      const { error } = await supabase
        .from('inventory_items')
        .update({ deleted_at: null })
        .eq('id', itemId);

      if (error) throw error;

      console.log('[INVENTORY] Item restored successfully');
    } catch (error) {
      console.error('[INVENTORY] Failed to restore item:', error);
      throw error;
    }
  }

  static async permanentlyDeleteItem(itemId: string): Promise<void> {
    try {
      console.log('[INVENTORY] Permanently deleting item:', itemId);

      // Get all asset groups for B2 deletion
      const { data: assetGroups } = await supabase
        .from('auction_files')
        .select('asset_group_id')
        .eq('item_id', itemId)
        .eq('variant', 'source');

      const uniqueAssetGroups = new Set(assetGroups?.map(f => f.asset_group_id) || []);

      // CRITICAL: Detach all files first so the worker can delete them
      const { error: detachError } = await supabase
        .from('auction_files')
        .update({ detached_at: new Date().toISOString() })
        .eq('item_id', itemId)
        .is('detached_at', null);

      if (detachError) {
        console.error('[INVENTORY] Error detaching files:', detachError);
        throw new Error('Failed to detach files before deletion');
      }

      // Delete from B2 via worker
      const workerUrl = import.meta.env.VITE_WORKER_URL;
      if (workerUrl && uniqueAssetGroups.size > 0) {
        for (const assetGroupId of uniqueAssetGroups) {
          try {
            const response = await fetch(`${workerUrl}/api/delete-asset-group`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ assetGroupId }),
            });

            if (!response.ok) {
              const errorData = await response.json();
              console.error('[INVENTORY] Worker deletion failed:', errorData);
              throw new Error(errorData.error || 'Worker deletion failed');
            }
          } catch (err) {
            console.error('[INVENTORY] Failed to delete asset group from B2:', assetGroupId, err);
            throw err;
          }
        }
      }

      // Delete all auction_files records for this item
      const { error: filesError } = await supabase
        .from('auction_files')
        .delete()
        .eq('item_id', itemId);

      if (filesError) {
        console.error('[INVENTORY] Error deleting file records:', filesError);
        throw filesError;
      }

      // Delete the item
      const { error } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      console.log('[INVENTORY] Item permanently deleted with all files from database and B2.');
    } catch (error) {
      console.error('[INVENTORY] Failed to permanently delete item:', error);
      throw error;
    }
  }
}
