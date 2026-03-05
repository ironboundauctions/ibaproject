import { supabase } from '../lib/supabase';

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
}

export class InventoryService {
  static async getAllItems(): Promise<InventoryItem[]> {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  static async getAvailableItems(): Promise<InventoryItem[]> {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('status', 'cataloged')
      .order('inventory_number', { ascending: true });

    if (error) throw error;
    return data || [];
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
    console.log(`[INVENTORY] Deleting inventory item ${id}`);

    // Mark all files as detached (soft delete for 30-day retention)
    const { error: detachError } = await supabase
      .from('auction_files')
      .update({ detached_at: new Date().toISOString() })
      .eq('item_id', id);

    if (detachError) {
      console.error('[INVENTORY] Error marking files as detached:', detachError);
    }

    // Delete the item (CASCADE will delete auction_files records)
    const { error } = await supabase
      .from('inventory_items')
      .delete()
      .eq('id', id);

    if (error) throw error;

    console.log(`[INVENTORY] Item deleted successfully`);
  }

  static async assignToEvent(inventoryId: string, eventId: string, lotNumber: string, saleOrder: number): Promise<void> {
    const { error: updateError } = await supabase
      .from('inventory_items')
      .update({ status: 'assigned_to_auction' })
      .eq('id', inventoryId);

    if (updateError) throw updateError;

    const { error: assignError } = await supabase
      .from('event_inventory_assignments')
      .insert({
        event_id: eventId,
        inventory_id: inventoryId,
        lot_number: lotNumber,
        sale_order: saleOrder
      });

    if (assignError) throw assignError;
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

  static async getItemsForEvent(eventId: string): Promise<InventoryItem[]> {
    const { data, error } = await supabase
      .from('event_inventory_assignments')
      .select(`
        inventory_id,
        lot_number,
        sale_order,
        inventory_items (*)
      `)
      .eq('event_id', eventId)
      .order('sale_order', { ascending: true });

    if (error) throw error;

    return (data || []).map((assignment: any) => ({
      ...assignment.inventory_items,
      lot_number: assignment.lot_number,
      sale_order: assignment.sale_order
    }));
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

      const { error } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      console.log('[INVENTORY] Item permanently deleted. Associated files and B2 cleanup will occur automatically.');
    } catch (error) {
      console.error('[INVENTORY] Failed to permanently delete item:', error);
      throw error;
    }
  }
}
