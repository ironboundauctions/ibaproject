import { supabase } from '../lib/supabase';
import { Consignor } from '../types/consigner';

export class ConsignorService {
  static async getAllConsignors(): Promise<Consignor[]> {
    return ConsignorService.getConsignors();
  }

  static async getConsignors(): Promise<Consignor[]> {
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

  static async getConsignorById(id: string): Promise<Consignor | null> {
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

  static async createConsignor(consignorData: any): Promise<Consignor> {
    const { data, error } = await supabase
      .from('consigners')
      .insert({
        customer_number: consignorData.customer_number,
        full_name: consignorData.full_name,
        nickname: consignorData.nickname || null,
        company: consignorData.company || null,
        address: consignorData.address,
        city: consignorData.city || null,
        state: consignorData.state || null,
        zip: consignorData.zip || null,
        email: consignorData.email || null,
        phone: consignorData.phone,
        tax_id: consignorData.tax_id || null,
        payment_terms: consignorData.payment_terms || null,
        commission_rate: consignorData.commission_rate || 0,
        notes: consignorData.notes || null
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error(`Customer number "${consignorData.customer_number}" is already in use. Please choose a different customer number or use "Generate New" to get an available one.`);
      }
      throw error;
    }

    return {
      ...data,
      total_items: 0,
      active_items: 0
    };
  }

  static async updateConsignor(id: string, updates: any): Promise<Consignor> {
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

    if (error) {
      if (error.code === '23505') {
        throw new Error(`Customer number "${updates.customer_number}" is already assigned to another consignor. Please use a different customer number.`);
      }
      throw error;
    }

    return {
      ...data,
      total_items: 0,
      active_items: 0
    };
  }

  static async deleteConsignor(id: string): Promise<void> {
    const { error } = await supabase
      .from('consigners')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  static async generateCustomerNumber(): Promise<string> {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    const { data: existingConsignors } = await supabase
      .from('consigners')
      .select('customer_number');

    const existingNumbers = new Set(
      (existingConsignors || []).map(c => c.customer_number).filter(Boolean)
    );

    for (const letter of letters) {
      for (let num = 1; num <= 9999; num++) {
        const customerNumber = `${letter}${num.toString().padStart(4, '0')}`;
        if (!existingNumbers.has(customerNumber)) {
          return customerNumber;
        }
      }
    }

    throw new Error('Unable to generate unique customer number');
  }

  static validateCustomerNumber(customerNumber: string, currentConsignorId?: string): { isValid: boolean; error?: string } {
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

export { ConsignorService as ConsignerService };
