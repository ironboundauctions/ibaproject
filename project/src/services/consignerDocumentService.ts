import { supabase } from '../lib/supabase';

export interface ConsignerDocument {
  id: string;
  consigner_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  document_label: string;
  is_image: boolean;
  uploaded_by: string | null;
  created_at: string;
}

const IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/tiff',
];

export function isImageType(mimeType: string): boolean {
  return IMAGE_MIME_TYPES.includes(mimeType.toLowerCase());
}

export const ConsignerDocumentService = {
  async getDocuments(consignerId: string): Promise<ConsignerDocument[]> {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase
      .from('consigner_id_documents')
      .select('*')
      .eq('consigner_id', consignerId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async uploadDocument(
    consignerId: string,
    file: File,
    label: string
  ): Promise<ConsignerDocument> {
    if (!supabase) throw new Error('Supabase not configured');

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const ext = file.name.split('.').pop() ?? 'bin';
    const path = `${consignerId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('consigner-documents')
      .upload(path, file, { upsert: false });
    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('consigner-documents')
      .getPublicUrl(path);

    const mimeType = file.type || 'application/octet-stream';
    const isImage = isImageType(mimeType);

    const { data, error } = await supabase
      .from('consigner_id_documents')
      .insert({
        consigner_id: consignerId,
        file_name: file.name,
        file_url: publicUrl,
        file_type: mimeType,
        file_size: file.size,
        document_label: label,
        is_image: isImage,
        uploaded_by: user.id,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteDocument(doc: ConsignerDocument): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');

    const url = new URL(doc.file_url);
    const pathParts = url.pathname.split('/consigner-documents/');
    if (pathParts.length === 2) {
      await supabase.storage.from('consigner-documents').remove([pathParts[1]]);
    }

    const { error } = await supabase
      .from('consigner_id_documents')
      .delete()
      .eq('id', doc.id);
    if (error) throw error;
  },

  async updateLabel(docId: string, label: string): Promise<void> {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase
      .from('consigner_id_documents')
      .update({ document_label: label })
      .eq('id', docId);
    if (error) throw error;
  },
};
