import { supabase } from '../lib/supabase';
import { IronDriveService } from './ironDriveService';

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
    // Get all files associated with this item BEFORE deleting anything
    const { data: files, error: filesError } = await supabase
      .from('auction_files')
      .select('file_key, source_user_id')
      .eq('item_id', id);

    if (filesError) {
      console.error('[INVENTORY] Error fetching files for cleanup:', filesError);
    }

    console.log(`[INVENTORY] === Deleting item ${id} ===`);
    console.log(`[INVENTORY] Found ${files?.length || 0} file(s) for item ${id}`);

    // For each file, check if other items reference it BEFORE we delete anything
    const filesToDelete: string[] = [];

    if (files && files.length > 0) {
      for (const file of files) {
        try {
          console.log(`[INVENTORY] Checking file: ${file.file_key}`);
          console.log(`[INVENTORY]   source_user_id: ${file.source_user_id || 'null (PC upload)'}`);

          // Files from IronDrive picker (source_user_id is set) are NEVER deleted from RAID
          if (file.source_user_id !== null) {
            console.log(`[INVENTORY]   Decision: SKIP (IronDrive picker file, never delete from RAID)`);
            continue;
          }

          // Check if any other items still reference this file (before deletion)
          const refCount = await IronDriveService.getReferenceCount(file.file_key);
          console.log(`[INVENTORY]   Reference count: ${refCount} (including this item)`);

          if (refCount === 1) {
            // Only this item references the file - safe to delete from RAID after DB deletion
            console.log(`[INVENTORY]   Decision: DELETE from RAID (last reference)`);
            filesToDelete.push(file.file_key);
          } else {
            console.log(`[INVENTORY]   Decision: KEEP (${refCount - 1} other item(s) still use this file)`);
          }
        } catch (error) {
          console.error(`[INVENTORY] Error checking file ${file.file_key}:`, error);
        }
      }
    }

    console.log(`[INVENTORY] Files marked for RAID deletion: ${filesToDelete.length}`);

    // Delete the item (CASCADE will delete auction_files records)
    const { error } = await supabase
      .from('inventory_items')
      .delete()
      .eq('id', id);

    if (error) throw error;

    console.log(`[INVENTORY] Item deleted from database`);

    // Now delete physical files that were marked for deletion
    if (filesToDelete.length > 0) {
      console.log(`[INVENTORY] Deleting ${filesToDelete.length} orphaned file(s) from RAID`);

      for (const file_key of filesToDelete) {
        try {
          console.log(`[INVENTORY]   Deleting from RAID: ${file_key}`);
          await IronDriveService.deleteFilePhysical(file_key);
          console.log(`[INVENTORY]   ✓ Successfully deleted from RAID: ${file_key}`);
        } catch (error) {
          console.error(`[INVENTORY]   ✗ Failed to delete from RAID: ${file_key}`, error);
          // Continue with other files even if one fails
        }
      }
      console.log(`[INVENTORY] RAID cleanup complete`);
    } else {
      console.log(`[INVENTORY] No files to delete from RAID`);
    }

    console.log(`[INVENTORY] === Item deletion complete ===`);
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
}
