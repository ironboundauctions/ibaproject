import { supabase } from '../lib/supabase';
import { Consigner } from '../types/consigner';

export class ConsignerService {
  static async getConsigners(): Promise<Consigner[]> {
    const { data, error } = await supabase
      .from('consigners')
      .select(`
        *,
        total_items:inventory_items(count),
        active_items:inventory_items!inner(count)
      `)
      .order('full_name', { ascending: true });

    if (error) throw error;

    return (data || []).map(c => ({
      ...c,
      total_items: c.total_items?.[0]?.count || 0,
      active_items: c.active_items?.[0]?.count || 0
    }));
  }

  static async getConsignerById(id: string): Promise<Consigner | null> {
    const { data, error } = await supabase
      .from('consigners')
      .select(`
        *,
        total_items:inventory_items(count),
        active_items:inventory_items!inner(count)
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      ...data,
      total_items: data.total_items?.[0]?.count || 0,
      active_items: data.active_items?.[0]?.count || 0
    };
  }

  static async createConsigner(consignerData: any): Promise<Consigner> {
    const { data, error } = await supabase
      .from('consigners')
      .insert({
        customer_number: consignerData.customer_number,
        full_name: consignerData.full_name,
        nickname: consignerData.nickname || null,
        company: consignerData.company || null,
        address: consignerData.address,
        city: consignerData.city || null,
        state: consignerData.state || null,
        zip: consignerData.zip || null,
        email: consignerData.email || null,
        phone: consignerData.phone,
        tax_id: consignerData.tax_id || null,
        payment_terms: consignerData.payment_terms || null,
        commission_rate: consignerData.commission_rate || 0,
        notes: consignerData.notes || null
      })
      .select()
      .single();

    if (error) throw error;

    return {
      ...data,
      total_items: 0,
      active_items: 0
    };
  }

  static async updateConsigner(id: string, updates: any): Promise<Consigner> {
    const { data, error } = await supabase
      .from('consigners')
      .update({
        customer_number: updates.customer_number,
        full_name: updates.full_name,
        nickname: updates.nickname || null,
        company: updates.company || null,
        address: updates.address,
        email: updates.email || null,
        phone: updates.phone,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return {
      ...data,
      total_items: 0,
      active_items: 0
    };
  }

  static async deleteConsigner(id: string): Promise<void> {
    const { error } = await supabase
      .from('consigners')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  static async generateCustomerNumber(): Promise<string> {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    // Get all existing customer numbers
    const { data: existingConsigners } = await supabase
      .from('consigners')
      .select('customer_number')
      .order('customer_number', { ascending: true });

    const existingNumbers = new Set(
      (existingConsigners || []).map(c => c.customer_number).filter(Boolean)
    );

    // Try each letter prefix in order
    for (const letter of letters) {
      for (let num = 1; num <= 9999; num++) {
        const customerNumber = `${letter}${num.toString().padStart(4, '0')}`;
        if (!existingNumbers.has(customerNumber)) {
          return customerNumber;
        }
      }
    }

    // Fallback (should never happen unless we have 260,000 consigners)
    throw new Error('Unable to generate unique customer number');
  }

  static validateCustomerNumber(customerNumber: string, currentConsignerId?: string): { isValid: boolean; error?: string } {
    if (!customerNumber || customerNumber.trim() === '') {
      return { isValid: false, error: 'Customer number is required' };
    }

    const pattern = /^[A-Z]\d{4}$/;
    if (!pattern.test(customerNumber)) {
      return { isValid: false, error: 'Customer number must be in format A#### (e.g., A0001, B0023)' };
    }

    return { isValid: true };
  }

  static async getInventoryItemsForEvent(eventId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('event_id', eventId)
      .order('sale_order', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  static async createInventoryItem(itemData: any): Promise<any> {
    const { data, error } = await supabase
      .from('inventory_items')
      .insert({
        event_id: itemData.event_id,
        inventory_number: itemData.inventory_number,
        consigner_customer_number: itemData.consigner_customer_number,
        title: itemData.title,
        description: itemData.description,
        additional_description: itemData.additional_description || null,
        reserve_price: itemData.reserve_price || null,
        category: itemData.category || null,
        condition: itemData.condition || null,
        estimated_value: itemData.estimated_value || null,
        image_url: itemData.image_url || null,
        additional_images: itemData.additional_images || null,
        specifications: itemData.specifications || null,
        status: 'cataloged'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async updateInventoryItem(id: string, updates: any): Promise<any> {
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

  static async deleteInventoryItem(id: string): Promise<void> {
    const { error } = await supabase
      .from('inventory_items')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  static async updateInventoryItemOrder(eventId: string, itemOrders: { id: string; sale_order: number }[]): Promise<void> {
    for (const item of itemOrders) {
      const { error } = await supabase
        .from('inventory_items')
        .update({ sale_order: item.sale_order })
        .eq('id', item.id);

      if (error) throw error;
    }
  }

  static async createLots(eventId: string): Promise<void> {
    const { data: items, error: fetchError } = await supabase
      .from('inventory_items')
      .select('id, sale_order')
      .eq('event_id', eventId)
      .is('lot_number', null)
      .order('sale_order', { ascending: true });

    if (fetchError) throw fetchError;

    if (!items || items.length === 0) {
      throw new Error('No items to assign lot numbers');
    }

    let lotNumber = 1;
    for (const item of items) {
      const { error: updateError } = await supabase
        .from('inventory_items')
        .update({ lot_number: lotNumber.toString() })
        .eq('id', item.id);

      if (updateError) throw updateError;
      lotNumber++;
    }
  }
}
