import React, { useState, useEffect } from 'react';
import { X, Upload, Loader, ExternalLink } from 'lucide-react';
import { InventoryItem, CreateInventoryItemData } from '../services/inventoryService';
import { Consigner } from '../types/consigner';
import { FileUploadService } from '../services/fileUploadService';
import { supabase } from '../lib/supabase';
import { EQUIPMENT_CATEGORIES } from '../utils/formatters';

interface Props {
  item?: InventoryItem | null;
  consigners: Consigner[];
  onSubmit: (data: CreateInventoryItemData) => Promise<any>;
  onCancel: () => void;
}

interface SelectedFile {
  id: string;
  file?: File;
  url?: string;
  backupUrl?: string;
  name: string;
  isVideo: boolean;
  type: 'pc' | 'irondrive';
  sourceKey?: string;
}

export default function InventoryItemFormNew({ item, consigners, onSubmit, onCancel }: Props) {
  const [formData, setFormData] = useState({
    inventory_number: item?.inventory_number || '',
    title: item?.title || '',
    description: item?.description || '',
    category: item?.category || '',
    reserve_price: item?.reserve_price?.toString() || '',
    estimated_value_low: item?.estimated_value_low?.toString() || '',
    estimated_value_high: item?.estimated_value_high?.toString() || '',
    consigner_customer_number: '',
    condition: item?.condition || '',
    additional_description: item?.notes || ''
  });

  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [error, setError] = useState('');

  useEffect(() => {
    if (item) {
      loadExistingFiles();
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://irondrive.ibaproject.bid') return;

      if (event.data.type === 'irondrive-selection' && event.data.files) {
        const ironDriveFiles: SelectedFile[] = event.data.files.map((file: any) => {
          const previewUrl = `https://raid.ibaproject.bid/pub/download/${file.source_key}`;
          const fileName = file.filename || file.name || file.source_key?.split('/').pop() || 'unknown';
          return {
            id: `irondrive-${Date.now()}-${Math.random()}`,
            type: 'irondrive' as const,
            url: previewUrl,
            name: fileName,
            isVideo: file.mime_type?.startsWith('video/') || false,
            sourceKey: file.source_key
          };
        });

        console.log('[IRONDRIVE] Received files from picker:', event.data.files);
        console.log('[IRONDRIVE] Mapped to SelectedFiles:', ironDriveFiles);

        setSelectedFiles(prev => [...prev, ...ironDriveFiles]);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [item]);

  const handleIronDrivePickerClick = () => {
    const returnUrl = encodeURIComponent(window.location.origin);
    window.open(
      `https://irondrive.ibaproject.bid/picker?return_to=${returnUrl}`,
      'irondrivePicker',
      'width=1200,height=800'
    );
  };

  const loadExistingFiles = async () => {
    if (!item?.id) return;

    try {
      const { data: files, error } = await supabase
        .from('auction_files')
        .select('*')
        .eq('item_id', item.id)
        .in('variant', ['display', 'thumb'])
        .is('detached_at', null)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (files && files.length > 0) {
        const groupedByAsset = files.reduce((acc, file) => {
          if (!acc[file.asset_group_id]) {
            acc[file.asset_group_id] = [];
          }
          acc[file.asset_group_id].push(file);
          return acc;
        }, {} as Record<string, any[]>);

        const existing = Object.values(groupedByAsset).map(group => {
          const displayFile = group.find(f => f.variant === 'display') || group[0];
          return {
            id: displayFile.asset_group_id,
            type: (displayFile.source_key ? 'irondrive' : 'pc') as 'pc' | 'irondrive',
            url: displayFile.cdn_url,
            name: displayFile.original_name || 'file',
            isVideo: displayFile.mime_type?.startsWith('video/') || false,
            sourceKey: displayFile.source_key
          };
        });
        setSelectedFiles(existing);
      }
    } catch (error) {
      console.error('[FORM] Error loading files:', error);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const files = Array.from(e.target.files);
    const mediaFiles = files.filter(f =>
      f.type.startsWith('image/') || f.type.startsWith('video/')
    );

    const newFiles: SelectedFile[] = mediaFiles.map(file => ({
      id: `temp-${Date.now()}-${Math.random()}`,
      type: 'pc' as const,
      file,
      url: URL.createObjectURL(file),
      name: file.name,
      isVideo: file.type.startsWith('video/')
    }));

    setSelectedFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (id: string) => {
    setSelectedFiles(prev => {
      const fileToRemove = prev.find(f => f.id === id);
      if (fileToRemove?.url && fileToRemove.file) {
        URL.revokeObjectURL(fileToRemove.url);
      }
      return prev.filter(f => f.id !== id);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const consigner = consigners.find(c => c.customer_number === formData.consigner_customer_number);

      const submitData: CreateInventoryItemData = {
        inventory_number: formData.inventory_number,
        title: formData.title,
        description: formData.description,
        category: formData.category,
        starting_price: parseFloat(formData.reserve_price) || 0,
        reserve_price: parseFloat(formData.reserve_price) || undefined,
        estimated_value_low: parseFloat(formData.estimated_value_low) || undefined,
        estimated_value_high: parseFloat(formData.estimated_value_high) || undefined,
        image_url: 'https://images.pexels.com/photos/1078884/pexels-photo-1078884.jpeg',
        consigner_id: consigner?.id,
        condition: formData.condition,
        notes: formData.additional_description
      };

      const result = await onSubmit(submitData);
      const savedItemId = item?.id || result?.id;

      if (!savedItemId) {
        throw new Error('Failed to get item ID');
      }

      const pcFiles = selectedFiles.filter(f => f.file);
      const ironDriveFiles = selectedFiles.filter(f => f.type === 'irondrive' && f.sourceKey && f.id.startsWith('irondrive-'));

      if (pcFiles.length > 0) {
        console.log(`[FORM] Uploading ${pcFiles.length} PC files to worker...`);

        const uploadResults = await FileUploadService.uploadMultiplePCFilesToWorker(
          pcFiles.map(f => f.file!),
          savedItemId,
          (current, total) => setUploadProgress({ current, total })
        );

        const failedUploads = uploadResults.filter(r => !r.success);
        if (failedUploads.length > 0) {
          console.error('[FORM] Some uploads failed:', failedUploads);
          throw new Error(`${failedUploads.length} file(s) failed to upload`);
        }

        console.log('[FORM] All PC files uploaded and processed successfully');
      }

      if (ironDriveFiles.length > 0) {
        console.log(`[FORM] Linking ${ironDriveFiles.length} IronDrive files...`);
        console.log('[FORM] IronDrive files to link:', ironDriveFiles);

        for (const file of ironDriveFiles) {
          const assetGroupId = crypto.randomUUID();

          const insertData = {
            item_id: savedItemId,
            asset_group_id: assetGroupId,
            variant: 'source',
            source_key: file.sourceKey,
            original_name: file.name,
            mime_type: file.isVideo ? 'video/mp4' : 'image/jpeg',
            published_status: 'pending'
          };

          console.log('[FORM] Inserting IronDrive file:', insertData);

          const { error: insertError } = await supabase.from('auction_files').insert(insertData);

          if (insertError) {
            console.error('[FORM] Error linking IronDrive file:', insertError);
            console.error('[FORM] Failed insert data:', insertData);
            throw new Error('Failed to link IronDrive file');
          }
        }

        console.log('[FORM] IronDrive files linked successfully - worker will process them');
      }

      // Handle file deletions for existing items
      if (item?.id) {
        const { data: existingFiles } = await supabase
          .from('auction_files')
          .select('id')
          .eq('item_id', item.id);

        if (existingFiles) {
          const existingFileIds = selectedFiles
            .filter(f => !f.file && f.id)
            .map(f => f.id);

          const filesToDelete = existingFiles.filter(f => !existingFileIds.includes(f.id));

          if (filesToDelete.length > 0) {
            await supabase
              .from('auction_files')
              .update({ detached_at: new Date().toISOString() })
              .in('id', filesToDelete.map(f => f.id));

            console.log('[FORM] Marked files as detached for cleanup');
          }
        }
      }

      onCancel();
    } catch (error) {
      console.error('[FORM] Submit error:', error);
      setError(error instanceof Error ? error.message : 'Failed to save item');
    } finally {
      setIsSubmitting(false);
      setUploadProgress({ current: 0, total: 0 });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-white mb-1">
            Inventory Number *
          </label>
          <input
            type="text"
            required
            value={formData.inventory_number}
            onChange={(e) => setFormData(prev => ({ ...prev, inventory_number: e.target.value }))}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-transparent text-gray-900 bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white mb-1">
            Category *
          </label>
          <select
            required
            value={formData.category}
            onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-transparent text-gray-900 bg-white"
          >
            <option value="">Select category...</option>
            {EQUIPMENT_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-white mb-1">
          Title *
        </label>
        <input
          type="text"
          required
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-transparent text-gray-900 bg-white"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-white mb-1">
          Description
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          rows={3}
          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-transparent text-gray-900 bg-white"
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-white mb-1">
            Reserve Price
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.reserve_price}
            onChange={(e) => setFormData(prev => ({ ...prev, reserve_price: e.target.value }))}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-transparent text-gray-900 bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white mb-1">
            Est. Value (Low)
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.estimated_value_low}
            onChange={(e) => setFormData(prev => ({ ...prev, estimated_value_low: e.target.value }))}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-transparent text-gray-900 bg-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white mb-1">
            Est. Value (High)
          </label>
          <input
            type="number"
            step="0.01"
            value={formData.estimated_value_high}
            onChange={(e) => setFormData(prev => ({ ...prev, estimated_value_high: e.target.value }))}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-ironbound-orange-500 focus:border-transparent text-gray-900 bg-white"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-white mb-2">
          Media Files
        </label>

        <div className="grid grid-cols-2 gap-4">
          {/* PC Upload */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-ironbound-orange-400 transition-colors">
            <input
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
            />
            <label
              htmlFor="file-upload"
              className="cursor-pointer flex flex-col items-center"
            >
              <Upload className="w-10 h-10 text-gray-400 mb-2" />
              <span className="text-sm font-medium text-white mb-1">
                Upload from PC
              </span>
              <span className="text-xs text-gray-400">
                Select files from your computer
              </span>
            </label>
          </div>

          {/* IronDrive Picker */}
          <button
            type="button"
            onClick={handleIronDrivePickerClick}
            className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-ironbound-orange-400 transition-colors"
          >
            <div className="flex flex-col items-center">
              <ExternalLink className="w-10 h-10 text-gray-400 mb-2" />
              <span className="text-sm font-medium text-white mb-1">
                Pick from IronDrive
              </span>
              <span className="text-xs text-gray-400">
                Select files from IronDrive storage
              </span>
            </div>
          </button>
        </div>

        {selectedFiles.length > 0 && (
          <div className="mt-4 grid grid-cols-4 gap-4">
            {selectedFiles.map(file => (
              <div key={file.id} className="relative group">
                {file.url ? (
                  file.isVideo ? (
                    <video src={file.url} className="w-full h-24 object-cover rounded" />
                  ) : (
                    <img src={file.url} alt={file.name} className="w-full h-24 object-cover rounded" />
                  )
                ) : (
                  <div className="w-full h-24 bg-gray-100 rounded flex items-center justify-center">
                    <span className="text-xs text-gray-500 truncate px-2">{file.name}</span>
                  </div>
                )}
                {file.type === 'irondrive' && (
                  <div className="absolute top-1 left-1 bg-blue-500 text-white text-xs px-2 py-0.5 rounded">
                    IronDrive
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeFile(file.id)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {uploadProgress.total > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-blue-700">
              Uploading {uploadProgress.current} of {uploadProgress.total} files...
            </span>
            <Loader className="w-4 h-4 animate-spin text-blue-700" />
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 bg-ironbound-orange-500 text-white px-4 py-2 rounded-lg hover:bg-ironbound-orange-600 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            item ? 'Update Item' : 'Create Item'
          )}
        </button>
      </div>
    </form>
  );
}
